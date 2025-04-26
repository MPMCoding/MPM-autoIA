import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  usuarios: any[] = [];
  estatisticas: any = {
    totalUsuarios: 0,
    usuariosAtivos: 0,
    acessosUltimaSemana: 0
  };
  novoUsuario: any = {
    nome: '',
    email: '',
    tipo: ''
  };
  displayDialog: boolean = false;
  tiposUsuario: any[] = [
    { label: 'Aluno', value: 'aluno' },
    { label: 'Professor', value: 'professor' },
    { label: 'Administrador', value: 'admin' }
  ];

  constructor() {}

  ngOnInit() {
    // Simulação de dados
    this.usuarios = [
      {
        id: 1,
        nome: 'João Silva',
        email: 'joao.silva@exemplo.com',
        tipo: 'aluno',
        status: 'Ativo',
        ultimoAcesso: '2023-05-10'
      },
      {
        id: 2,
        nome: 'Maria Oliveira',
        email: 'maria.oliveira@exemplo.com',
        tipo: 'professor',
        status: 'Ativo',
        ultimoAcesso: '2023-05-12'
      },
      {
        id: 3,
        nome: 'Carlos Santos',
        email: 'carlos.santos@exemplo.com',
        tipo: 'admin',
        status: 'Ativo',
        ultimoAcesso: '2023-05-15'
      }
    ];

    this.calcularEstatisticas();
  }

  calcularEstatisticas() {
    this.estatisticas.totalUsuarios = this.usuarios.length;
    this.estatisticas.usuariosAtivos = this.usuarios.filter(u => u.status === 'Ativo').length;
    this.estatisticas.acessosUltimaSemana = 15; // Valor simulado
  }

  abrirDialogNovoUsuario() {
    this.novoUsuario = {
      nome: '',
      email: '',
      tipo: ''
    };
    this.displayDialog = true;
  }

  salvarUsuario() {
    if (this.validarUsuario()) {
      const novoUsuario = {
        ...this.novoUsuario,
        id: this.usuarios.length + 1,
        status: 'Ativo',
        ultimoAcesso: new Date().toISOString().split('T')[0]
      };
      
      this.usuarios.push(novoUsuario);
      this.calcularEstatisticas();
      this.displayDialog = false;
    }
  }

  validarUsuario(): boolean {
    return !!this.novoUsuario.nome && 
           !!this.novoUsuario.email && 
           !!this.novoUsuario.tipo;
  }

  cancelar() {
    this.displayDialog = false;
  }
}