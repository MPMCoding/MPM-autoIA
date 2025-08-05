import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  loading: boolean = false;
  showSupabaseConfig: boolean = false;
  supabaseUrl: string = '';
  supabaseKey: string = '';

  constructor(
    private router: Router,
    private messageService: MessageService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Verificar se já está logado
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }

    // Restaurar sessão se existir
    this.authService.restoreSession();

    // Verificar se as credenciais do Supabase estão configuradas
    const savedUrl = localStorage.getItem('supabaseUrl');
    const savedKey = localStorage.getItem('supabaseKey');
    
    if (savedUrl && savedKey) {
      this.authService.configureSupabase(savedUrl, savedKey);
    } else {
      this.showSupabaseConfig = true;
    }
  }

  async login() {
    if (!this.email || !this.password) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Por favor, preencha todos os campos.'
      });
      return;
    }

    this.loading = true;

    try {
      const result = await this.authService.login(this.email, this.password);
      
      if (result.success) {
        // Mostrar mensagem de sucesso ou aviso
        const severity = result.daysUntilExpiration && result.daysUntilExpiration <= 7 ? 'warn' : 'success';
        
        this.messageService.add({
          severity,
          summary: severity === 'warn' ? 'Atenção' : 'Sucesso',
          detail: result.message || 'Login realizado com sucesso!',
          life: severity === 'warn' ? 8000 : 3000
        });
        
        this.router.navigate(['/dashboard']);
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: result.message || 'Erro ao fazer login.'
        });
      }
    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Ocorreu um erro ao tentar fazer login.'
      });
      console.error('Erro de login:', error);
    } finally {
      this.loading = false;
    }
  }

  configureSupabase() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Por favor, preencha a URL e a chave do Supabase.'
      });
      return;
    }

    // Salvar credenciais no localStorage
    localStorage.setItem('supabaseUrl', this.supabaseUrl);
    localStorage.setItem('supabaseKey', this.supabaseKey);
    
    // Configurar o serviço
    this.authService.configureSupabase(this.supabaseUrl, this.supabaseKey);
    
    this.showSupabaseConfig = false;
    
    this.messageService.add({
      severity: 'success',
      summary: 'Sucesso',
      detail: 'Configuração do Supabase salva com sucesso!'
    });
  }

  toggleSupabaseConfig() {
    this.showSupabaseConfig = !this.showSupabaseConfig;
  }

  forgotPassword() {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Funcionalidade de recuperação de senha será implementada em breve.'
    });
  }

  register() {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Entre em contato com o suporte para criar uma nova conta.'
    });
  }
}