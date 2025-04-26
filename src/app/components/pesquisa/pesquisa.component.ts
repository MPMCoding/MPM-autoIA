import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-pesquisa',
  templateUrl: './pesquisa.component.html',
  styleUrls: ['./pesquisa.component.scss']
})
export class PesquisaComponent implements OnInit {
  searchQuery: string = '';
  searchResults: any[] = [];
  isSearching: boolean = false;

  constructor() {}

  ngOnInit() {
  }

  search() {
    if (!this.searchQuery.trim()) {
      return;
    }
    
    this.isSearching = true;
    
    // Simulação de pesquisa
    setTimeout(() => {
      this.searchResults = [
        {
          title: 'Estruturas de Controle em Python',
          content: 'As estruturas de controle em Python incluem condicionais (if, elif, else) e loops (for, while).',
          type: 'Resumo',
          match: 95
        },
        {
          title: 'Funções em Python',
          content: 'Funções são blocos de código reutilizáveis que realizam uma tarefa específica.',
          type: 'Resumo',
          match: 85
        },
        {
          title: 'O que são estruturas de controle?',
          content: 'Pergunta sobre conceitos básicos de programação.',
          type: 'Pergunta',
          match: 80
        }
      ];
      this.isSearching = false;
    }, 1000);
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
  }
}