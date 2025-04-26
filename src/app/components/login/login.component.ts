import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DatabaseService } from '../../services/database.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  loading: boolean = false;

  constructor(
    private router: Router,
    private messageService: MessageService,
    private databaseService: DatabaseService
  ) {}

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
      const authenticated = await this.databaseService.authenticateUser(this.email, this.password);
      
      if (authenticated) {
        this.messageService.add({
          severity: 'success',
          summary: 'Sucesso',
          detail: 'Login realizado com sucesso!'
        });
        this.router.navigate(['/dashboard']);
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Erro',
          detail: 'Email ou senha incorretos.'
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

  forgotPassword() {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Funcionalidade de recuperação de senha não implementada neste protótipo.'
    });
  }

  register() {
    this.messageService.add({
      severity: 'info',
      summary: 'Info',
      detail: 'Funcionalidade de cadastro não implementada neste protótipo.'
    });
  }
}