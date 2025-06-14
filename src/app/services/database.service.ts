import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  constructor(private electronService: ElectronService) {}
  
  // Método para executar consultas SQL no banco de dados
  private async executeQuery(query: string, params: any[] = []): Promise<any> {
    if (!this.electronService.isElectron || !this.electronService.ipcRenderer) {
      console.warn('Não é possível executar consulta SQL fora do ambiente Electron');
      return null;
    }
    
    return new Promise((resolve, reject) => {
      this.electronService.ipcRenderer?.send('db-query', query, params);
      
      const listener = (event: any, result: any) => {
        this.electronService.ipcRenderer?.removeListener('db-result', listener);
        if (result.success) {
          resolve(result.data);
        } else {
          reject(new Error(result.error));
        }
      };
      
      this.electronService.ipcRenderer?.on('db-result', listener);
    });
  }

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
    if (this.electronService.isElectron) {
      try {
        // Cria a tabela se não existir
        await this.createPerguntasTableIfNotExists();
        
        // Consulta as perguntas no banco de dados
        const result = await this.executeQuery(
          'SELECT * FROM perguntas_respondidas ORDER BY data_criacao DESC'
        );
        
        return result || [];
      } catch (error) {
        console.error('Erro ao obter perguntas do banco de dados:', error);
        // Retorna dados mockados em caso de erro
        return this.getMockPerguntas();
      }
    } else {
      // Retorna dados mockados para desenvolvimento web
      return this.getMockPerguntas();
    }
  }
  
  // Método para salvar uma pergunta respondida
  async savePergunta(pergunta: string, resposta: string, disciplina?: string, modulo?: string): Promise<boolean> {
    if (!this.electronService.isElectron) {
      console.warn('Não é possível salvar pergunta fora do ambiente Electron');
      return false;
    }
    
    try {
      // Cria a tabela se não existir
      await this.createPerguntasTableIfNotExists();
      
      // Insere a pergunta no banco de dados
      await this.executeQuery(
        'INSERT INTO perguntas_respondidas (pergunta, resposta, disciplina, modulo, data_criacao) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [pergunta, resposta, disciplina || null, modulo || null]
      );
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar pergunta no banco de dados:', error);
      return false;
    }
  }
  
  // Método para criar a tabela de perguntas respondidas se não existir
  private async createPerguntasTableIfNotExists(): Promise<void> {
    try {
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS perguntas_respondidas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pergunta TEXT NOT NULL,
          resposta TEXT NOT NULL,
          disciplina TEXT,
          modulo TEXT,
          data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      console.error('Erro ao criar tabela de perguntas respondidas:', error);
      throw error;
    }
  }
  
  // Dados mockados para desenvolvimento
  private getMockPerguntas(): any[] {
    return [
      {
        id: 1,
        pergunta: 'Qual a diferença entre listas e tuplas em Python?',
        resposta: 'Listas são mutáveis e podem ser modificadas após a criação, enquanto tuplas são imutáveis e não podem ser alteradas após a criação.',
        disciplina: 'Python',
        modulo: 'Módulo 2',
        data_criacao: '2023-05-15 10:30:00'
      },
      {
        id: 2,
        pergunta: 'O que é uma chave primária em um banco de dados relacional?',
        resposta: 'Uma chave primária é um campo ou conjunto de campos que identifica de forma única cada registro em uma tabela de banco de dados.',
        disciplina: 'SQL',
        modulo: 'Módulo 1',
        data_criacao: '2023-05-14 14:45:00'
      },
      {
        id: 3,
        pergunta: 'Explique a complexidade de tempo O(n log n).',
        resposta: 'A complexidade O(n log n) é característica de algoritmos eficientes como Merge Sort e Quick Sort. É mais eficiente que O(n²) para conjuntos grandes de dados.',
        disciplina: 'Algoritmos',
        modulo: 'Módulo 3',
        data_criacao: '2023-05-13 09:15:00'
      }
    ];
  }
}