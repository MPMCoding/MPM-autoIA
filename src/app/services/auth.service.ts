import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';

export interface UserProfile {
  id: string;
  email: string;
  nome: string;
  ativo: boolean;
  data_pagamento: string;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  success: boolean;
  user?: UserProfile;
  message?: string;
  daysUntilExpiration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;
  private currentUserSubject = new BehaviorSubject<UserProfile | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private messageService: MessageService
  ) {
    // Inicializar com credenciais vazias - serão configuradas depois
    this.supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  // Método para configurar as credenciais do Supabase
  configureSupabase(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Verificar se o Supabase está configurado
  private isSupabaseConfigured(): boolean {
    const savedUrl = localStorage.getItem('supabaseUrl');
    const savedKey = localStorage.getItem('supabaseKey');
    return !!(savedUrl && savedKey && savedUrl !== '' && savedKey !== '');
  }

  // Método principal de login com validações
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      // Verificar se o Supabase está configurado
      if (!this.isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase não configurado. Configure as credenciais primeiro.'
        };
      }
      // Autenticar com Supabase
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        return {
          success: false,
          message: 'Email ou senha incorretos.'
        };
      }

      if (!authData.user) {
        return {
          success: false,
          message: 'Erro na autenticação.'
        };
      }

      // Buscar perfil do usuário
      console.log('Buscando perfil para usuário ID:', authData.user.id);
      const { data: profile, error: profileError } = await this.supabase
        .from('usuarios')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      console.log('Resultado da busca:', { profile, profileError });

      if (profileError || !profile) {
        console.error('Erro ao buscar perfil:', profileError);
        return {
          success: false,
          message: `Perfil do usuário não encontrado. Erro: ${profileError?.message || 'Usuário não existe na tabela usuarios'}`
        };
      }

      // Verificar se o usuário está ativo
      if (!profile.ativo) {
        await this.logout();
        return {
          success: false,
          message: 'Sua conta está inativa. Entre em contato com o suporte.'
        };
      }

      // Verificar data de pagamento
      const paymentValidation = this.validatePaymentDate(profile.data_pagamento);
      
      if (!paymentValidation.isValid) {
        await this.logout();
        return {
          success: false,
          message: paymentValidation.message
        };
      }

      // Login bem-sucedido
      const userProfile: UserProfile = {
        id: profile.id,
        email: profile.email,
        nome: profile.nome,
        ativo: profile.ativo,
        data_pagamento: profile.data_pagamento,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };

      this.currentUserSubject.next(userProfile);
      
      // Salvar no localStorage para persistência
      localStorage.setItem('currentUser', JSON.stringify(userProfile));

      return {
        success: true,
        user: userProfile,
        message: paymentValidation.warningMessage || 'Login realizado com sucesso!',
        daysUntilExpiration: paymentValidation.daysUntilExpiration
      };

    } catch (error) {
      console.error('Erro no login:', error);
      return {
        success: false,
        message: 'Erro interno do servidor. Tente novamente.'
      };
    }
  }

  // Validar data de pagamento
  private validatePaymentDate(dataPagamento: string): {
    isValid: boolean;
    message?: string;
    warningMessage?: string;
    daysUntilExpiration?: number;
  } {
    const today = new Date();
    const paymentDate = new Date(dataPagamento);
    
    // Calcular data de vencimento (1 mês após a data de pagamento)
    const expirationDate = new Date(paymentDate);
    expirationDate.setMonth(expirationDate.getMonth() + 1);
    
    // Verificar se já venceu
    if (today > expirationDate) {
      return {
        isValid: false,
        message: 'Sua assinatura venceu. Renove seu plano para continuar usando o sistema.'
      };
    }
    
    // Calcular dias até o vencimento
    const timeDiff = expirationDate.getTime() - today.getTime();
    const daysUntilExpiration = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Aviso se estiver próximo do vencimento (7 dias ou menos)
    if (daysUntilExpiration <= 7) {
      return {
        isValid: true,
        warningMessage: `Atenção: Sua assinatura vence em ${daysUntilExpiration} dia(s). Renove para não perder o acesso.`,
        daysUntilExpiration
      };
    }
    
    return {
      isValid: true,
      daysUntilExpiration
    };
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
    } catch (error) {
      console.error('Erro no logout:', error);
    } finally {
      this.currentUserSubject.next(null);
      localStorage.removeItem('currentUser');
      // A navegação será feita pelo componente que chama o logout
    }
  }

  // Verificar se está logado
  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  // Obter usuário atual
  getCurrentUser(): UserProfile | null {
    return this.currentUserSubject.value;
  }

  // Restaurar sessão do localStorage
  restoreSession(): void {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const userProfile = JSON.parse(savedUser);
        
        // Verificar se a sessão ainda é válida
        const paymentValidation = this.validatePaymentDate(userProfile.data_pagamento);
        
        if (paymentValidation.isValid && userProfile.ativo) {
          this.currentUserSubject.next(userProfile);
        } else {
          // Sessão inválida, fazer logout
          this.logout();
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }

  // Atualizar perfil do usuário
  async updateProfile(updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) return false;

      const { error } = await this.supabase
        .from('usuarios')
        .update(updates)
        .eq('id', currentUser.id);

      if (error) {
        console.error('Erro ao atualizar perfil:', error);
        return false;
      }

      // Atualizar o usuário local
      const updatedUser = { ...currentUser, ...updates };
      this.currentUserSubject.next(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      return true;
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return false;
    }
  }

  // Verificar status da assinatura
  getSubscriptionStatus(): {
    isActive: boolean;
    daysUntilExpiration: number;
    expirationDate: Date;
  } {
    const user = this.getCurrentUser();
    if (!user) {
      return {
        isActive: false,
        daysUntilExpiration: 0,
        expirationDate: new Date()
      };
    }

    const paymentDate = new Date(user.data_pagamento);
    const expirationDate = new Date(paymentDate);
    expirationDate.setMonth(expirationDate.getMonth() + 1);
    
    const today = new Date();
    const timeDiff = expirationDate.getTime() - today.getTime();
    const daysUntilExpiration = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return {
      isActive: daysUntilExpiration > 0 && user.ativo,
      daysUntilExpiration: Math.max(0, daysUntilExpiration),
      expirationDate
    };
  }
}