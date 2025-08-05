import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | Promise<boolean> | boolean {
    
    // Verificar se está logado
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    // Verificar status da assinatura
    const subscriptionStatus = this.authService.getSubscriptionStatus();
    
    if (!subscriptionStatus.isActive) {
      this.messageService.add({
        severity: 'error',
        summary: 'Acesso Negado',
        detail: 'Sua assinatura expirou. Renove para continuar usando o sistema.',
        life: 5000
      });
      
      this.authService.logout();
      return false;
    }

    // Mostrar aviso se estiver próximo do vencimento
    if (subscriptionStatus.daysUntilExpiration <= 7) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Assinatura Próxima do Vencimento',
        detail: `Sua assinatura vence em ${subscriptionStatus.daysUntilExpiration} dia(s). Renove para não perder o acesso.`,
        life: 8000
      });
    }

    return true;
  }
}