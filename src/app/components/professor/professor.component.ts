import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-professor',
  templateUrl: './professor.component.html',
  styleUrls: ['./professor.component.scss']
})
export class ProfessorComponent implements OnInit {
  atividades: any[] = [];
  novaAtividade: any = {
    titulo: '',
    descricao: '',
    modulo: '',
    disciplina: '',
    prazo: ''
  };
  displayDialog: boolean = false;
  disciplinas: string[] = ['Python', 'SQL', 'Algoritmos', 'JavaScript', 'Java'];
  modulos: string[] = ['Módulo 1', 'Módulo 2', 'Módulo 3', 'Módulo 4'];

  constructor() {}

  ngOnInit() {
    // Simulação de dados
    this.atividades = [
      {
        id: 1,
        titulo: 'Fundamentos de Python',
        descricao: 'Módulo 2: Estruturas de Controle',
        modulo: 'Módulo 2',
        disciplina: 'Python',
        status: 'Ativa',
        prazo: '2023-05-15'
      },
      {
        id: 2,
        titulo: 'Banco de Dados SQL',
        descricao: 'Módulo 1: Introdução a Bancos Relacionais',
        modulo: 'Módulo 1',
        disciplina: 'SQL',
        status: 'Ativa',
        prazo: '2023-05-25'
      }
    ];
  }

  abrirDialogNovaAtividade() {
    this.novaAtividade = {
      titulo: '',
      descricao: '',
      modulo: '',
      disciplina: '',
      prazo: ''
    };
    this.displayDialog = true;
  }

  salvarAtividade() {
    if (this.validarAtividade()) {
      const novaAtividade = {
        ...this.novaAtividade,
        id: this.atividades.length + 1,
        status: 'Ativa'
      };
      
      this.atividades.push(novaAtividade);
      this.displayDialog = false;
    }
  }

  validarAtividade(): boolean {
    return !!this.novaAtividade.titulo && 
           !!this.novaAtividade.disciplina && 
           !!this.novaAtividade.prazo;
  }

  cancelar() {
    this.displayDialog = false;
  }
}