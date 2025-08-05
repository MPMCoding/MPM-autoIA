import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, UserProfile } from '../../services/auth.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-user-info',
  templateUrl: './user-info.component.html',
  styleUrls: ['./user-info.component.scss']
})
export class UserInfoComponent implements OnInit, OnDestroy {
  currentUser: UserProfile | null = null;
  subscriptionStatus: any = null;
  private userSubscription: Subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit() {
    // Observar mudanças no usuário atual
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.updateSubscriptionStatus();
      }
    });
  }

  ngOnDestroy() {
    this.userSubscription.unsubscribe();
  }

  updateSubscriptionStatus() {
    this.subscriptionStatus = this.authService.getSubscriptionStatus();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }

  getStatusSeverity(): string {
    if (!this.subscriptionStatus) return 'info';
    
    if (!this.subscriptionStatus.isActive) return 'danger';
    if (this.subscriptionStatus.daysUntilExpiration <= 3) return 'danger';
    if (this.subscriptionStatus.daysUntilExpiration <= 7) return 'warning';
    return 'success';
  }

  getStatusText(): string {
    if (!this.subscriptionStatus) return 'Carregando...';
    
    if (!this.subscriptionStatus.isActive) {
      return 'Assinatura Expirada';
    }
    
    if (this.subscriptionStatus.daysUntilExpiration <= 0) {
      return 'Assinatura Expirada';
    }
    
    if (this.subscriptionStatus.daysUntilExpiration === 1) {
      return 'Expira Hoje';
    }
    
    if (this.subscriptionStatus.daysUntilExpiration <= 7) {
      return `Expira em ${this.subscriptionStatus.daysUntilExpiration} dias`;
    }
    
    return 'Assinatura Ativa';
  }

  formatExpirationDate(): string {
    if (!this.subscriptionStatus) return '';
    
    return this.subscriptionStatus.expirationDate.toLocaleDateString('pt-BR');
  }

  showRenewalInfo() {
    this.messageService.add({
      severity: 'info',
      summary: 'Renovação de Assinatura',
      detail: 'Entre em contato com o suporte para renovar sua assinatura e continuar usando o sistema.',
      life: 5000
    });
  }
}