import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  constructor(private electronService: ElectronService) {}

  // Obtém todas as atividades do banco de dados
  async getActivities(): Promise<any[]> {
    if (this.electronService.isElectron) {
      return await this.electronService.getActivities();
    } else {
      // Dados mockados para desenvolvimento web
      return [
        {
          id: 1,
          titulo: 'Fundamentos de Python',
          descricao: 'Módulo 2: Estruturas de Controle',
          modulo: 'Módulo 2',
          disciplina: 'Python',
          status: 'Concluído',
          nota: 9.5,
          prazo: '2023-05-15'
        },
        {
          id: 2,
          titulo: 'Banco de Dados SQL',
          descricao: 'Módulo 1: Introdução a Bancos Relacionais',
          modulo: 'Módulo 1',
          disciplina: 'SQL',
          status: 'Pendente',
          nota: null,
          prazo: '2023-05-25'
        },
        {
          id: 3,
          titulo: 'Algoritmos e Estruturas de Dados',
          descricao: 'Módulo 3: Complexidade de Algoritmos',
          modulo: 'Módulo 3',
          disciplina: 'Algoritmos',
          status: 'Concluído',
          nota: 8.0,
          prazo: '2023-05-10'
        }
      ];
    }
  }

  // Método para autenticação de usuário
  async authenticateUser(email: string, password: string): Promise<boolean> {
    // Em uma aplicação real, isso verificaria o banco de dados
    // Para este exemplo, aceitamos qualquer login com email e senha não vazios
    return email && password ? true : false;
  }

  // Método para obter resumos de tópicos
  async getResumos(disciplina?: string, modulo?: string): Promise<any[]> {
    // Dados mockados para desenvolvimento
    return [
      {
        id: 1,
        titulo: 'Estruturas de Controle em Python',
        disciplina: 'Python',
        modulo: 'Módulo 2',
        conteudo: 'As estruturas de controle em Python incluem condicionais (if, elif, else) e loops (for, while). Estas estruturas permitem controlar o fluxo de execução do programa com base em condições específicas.'
      },
      {
        id: 2,
        titulo: 'Introdução a Bancos Relacionais',
        disciplina: 'SQL',
        modulo: 'Módulo 1',
        conteudo: 'Bancos de dados relacionais organizam dados em tabelas com linhas e colunas. O SQL (Structured Query Language) é utilizado para manipular e consultar esses dados através de comandos como SELECT, INSERT, UPDATE e DELETE.'
      },
      {
        id: 3,
        titulo: 'Complexidade de Algoritmos',
        disciplina: 'Algoritmos',
        modulo: 'Módulo 3',
        conteudo: 'A complexidade de algoritmos refere-se à quantidade de recursos (tempo e espaço) necessários para executar um algoritmo. A notação Big O é utilizada para descrever o comportamento assintótico de um algoritmo.'
      }
    ];
  }

  // Método para obter perguntas salvas
  async getPerguntas(): Promise<any[]> {
    return [
      {
        id: 1,
        pergunta: 'Qual a diferença entre listas e tuplas em Python?',
        resposta: 'Listas são mutáveis e podem ser modificadas após a criação, enquanto tuplas são imutáveis e não podem ser alteradas após a criação.',
        disciplina: 'Python',
        modulo: 'Módulo 2'
      },
      {
        id: 2,
        pergunta: 'O que é uma chave primária em um banco de dados relacional?',
        resposta: 'Uma chave primária é um campo ou conjunto de campos que identifica de forma única cada registro em uma tabela de banco de dados.',
        disciplina: 'SQL',
        modulo: 'Módulo 1'
      },
      {
        id: 3,
        pergunta: 'Explique a complexidade de tempo O(n log n).',
        resposta: 'A complexidade O(n log n) é característica de algoritmos eficientes como Merge Sort e Quick Sort. É mais eficiente que O(n²) para conjuntos grandes de dados.',
        disciplina: 'Algoritmos',
        modulo: 'Módulo 3'
      }
    ];
  }
}