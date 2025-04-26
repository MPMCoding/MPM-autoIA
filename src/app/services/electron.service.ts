import { Injectable } from '@angular/core';
import { isDevMode } from '@angular/core';

// Interface para o objeto electron exposto pelo preload.js
interface ElectronAPI {
  getAutomationPort: () => number;
  getActivities: () => Promise<any[]>;
  platform: string;
  isElectron: boolean;
}

// Interface para o IPC Renderer
interface IpcRenderer {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  removeListener: (channel: string, listener: Function) => void;
  removeAllListeners: (channel: string) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  private _electron: ElectronAPI | null = null;
  private _ipcRenderer: IpcRenderer | null = null;

  constructor() {
    // Verifica se estamos rodando no Electron
    if (this.isElectronApp()) {
      try {
        this._electron = (window as any).electron;
        this._ipcRenderer = (window as any).electron.ipcRenderer;
        console.log('Electron inicializado com sucesso');
      } catch (error) {
        console.error('Erro ao inicializar Electron:', error);
        this._electron = null;
        this._ipcRenderer = null;
      }
    }
  }

  // Verifica se a aplicação está rodando no Electron
  get isElectron(): boolean {
    // Verificação mais robusta para o ambiente Electron
    try {
      // Verifica se a propriedade isElectron está definida explicitamente
      if (window && (window as any).electron && (window as any).electron.isElectron === true) {
        console.log('Ambiente Electron detectado via propriedade explícita');
        return true;
      }
      
      // Verificação alternativa baseada em características do ambiente
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.indexOf(' electron/') > -1) {
        console.log('Ambiente Electron detectado via userAgent');
        return true;
      }
      
      // Verificação padrão
      return this.isElectronApp();
    } catch (error) {
      console.error('Erro ao verificar ambiente Electron:', error);
      return false;
    }
  }

  // Acesso ao IPC Renderer
  get ipcRenderer(): IpcRenderer | null {
    return this._ipcRenderer;
  }

  // Retorna a porta configurada para a automação
  get automationPort(): number {
    if (this._electron) {
      try {
        return this._electron.getAutomationPort();
      } catch (error) {
        console.error('Erro ao obter porta de automação:', error);
        return 3000; // Porta padrão em caso de erro
      }
    }
    return 3000; // Porta padrão caso não esteja no Electron
  }

  // Retorna a plataforma atual (win32, darwin, linux)
  get platform(): string {
    if (this._electron) {
      try {
        return this._electron.platform;
      } catch (error) {
        console.error('Erro ao obter plataforma:', error);
        return 'web'; // Plataforma padrão em caso de erro
      }
    }
    return 'web';
  }

  // Obtém as atividades do banco de dados SQLite
  async getActivities(): Promise<any[]> {
    if (this._electron) {
      try {
        return await this._electron.getActivities();
      } catch (error) {
        console.error('Erro ao acessar o banco de dados:', error);
        // Retorna dados mockados em caso de erro
        return this.getMockActivities();
      }
    }
    // Retorna dados mockados se não estiver no Electron
    return this.getMockActivities();
  }

  // Dados mockados para desenvolvimento e testes
  private getMockActivities(): any[] {
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

  // Verifica se estamos rodando no Electron
  private isElectronApp(): boolean {
    try {
      return !!(window && (window as any).electron);
    } catch (error) {
      console.error('Erro ao verificar ambiente Electron:', error);
      return false;
    }
  }
}
