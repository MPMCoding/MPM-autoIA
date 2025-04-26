import { Injectable } from "@angular/core";

// Interface para o objeto electron exposto pelo preload.js (se houver)
// Ajustada para refletir o que *poderia* ser exposto
interface ElectronAPI {
  platform?: string;
  isElectron?: boolean;
  ipcRenderer?: IpcRenderer; // Adicionando ipcRenderer aqui como possibilidade
  // Outras funções que seu preload possa expor
  getAutomationPort?: () => number;
  getActivities?: () => Promise<any[]>;
}

// Interface para o IPC Renderer (mantida)
interface IpcRenderer {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  removeListener: (channel: string, listener: Function) => void;
  removeAllListeners: (channel: string) => void;
}

@Injectable({
  providedIn: "root"
})
export class ElectronService {
  private _electronApi: ElectronAPI | null = null;
  private _ipcRenderer: IpcRenderer | null = null;
  private _isElectron: boolean = false;

  constructor() {
    console.log("[ElectronService] Constructor - Iniciando verificação do ambiente.");
    // Verifica se estamos rodando no Electron de forma mais robusta
    this._isElectron = this.checkIfElectron();

    if (this._isElectron) {
      console.log("[ElectronService] Ambiente Electron detectado. Tentando inicializar API e ipcRenderer.");
      try {
        // Tenta acessar a API exposta pelo preload (se existir)
        if ((window as any).electron) {
          this._electronApi = (window as any).electron;
          console.log("[ElectronService] API 'window.electron' encontrada.", this._electronApi);
          // Tenta obter ipcRenderer a partir da API exposta
          if (this._electronApi?.ipcRenderer) {
            this._ipcRenderer = this._electronApi.ipcRenderer;
            console.log("[ElectronService] ipcRenderer encontrado em 'window.electron.ipcRenderer'.");
          }
        }

        // Se não encontrou na API exposta, tenta o método require (comum com contextIsolation=false)
        if (!this._ipcRenderer && typeof window.require === "function") {
          console.log("[ElectronService] Tentando obter ipcRenderer via window.require('electron').");
          try {
            const electronRequire = window.require("electron");
            if (electronRequire && electronRequire.ipcRenderer) {
              this._ipcRenderer = electronRequire.ipcRenderer;
              console.log("[ElectronService] ipcRenderer encontrado via window.require('electron').ipcRenderer.");
            }
          } catch (requireError) {
            console.warn("[ElectronService] Falha ao tentar window.require('electron'):", requireError);
          }
        }

        // Se ainda não encontrou, verifica se está diretamente na window (menos comum, mas possível)
        if (!this._ipcRenderer && (window as any).ipcRenderer) {
            console.log("[ElectronService] Tentando obter ipcRenderer diretamente de 'window.ipcRenderer'.");
            this._ipcRenderer = (window as any).ipcRenderer;
            console.log("[ElectronService] ipcRenderer encontrado em 'window.ipcRenderer'.");
        }

        if (this._ipcRenderer) {
          console.log("[ElectronService] ipcRenderer inicializado com sucesso!");
        } else {
          console.error("[ElectronService] ERRO CRÍTICO: Não foi possível inicializar o ipcRenderer! Funcionalidades Electron não operarão.");
        }

      } catch (error) {
        console.error("[ElectronService] Erro durante a inicialização do Electron API/ipcRenderer:", error);
        this._electronApi = null;
        this._ipcRenderer = null;
        this._isElectron = false; // Marca como não-electron se a inicialização falhar
      }
    } else {
      console.log("[ElectronService] Ambiente não-Electron detectado.");
    }
  }

  // Verifica se a aplicação está rodando no Electron
  get isElectron(): boolean {
    return this._isElectron;
  }

  // Acesso ao IPC Renderer
  get ipcRenderer(): IpcRenderer | null {
    // Adiciona um log para quando o ipcRenderer é acessado
    // Cuidado: Isso pode gerar muitos logs dependendo da frequência de acesso
    // console.log("[ElectronService] Acessando getter ipcRenderer. Valor:", this._ipcRenderer ? "Definido" : "Nulo");
    return this._ipcRenderer;
  }

  // Retorna a porta configurada para a automação
  get automationPort(): number {
    if (this._electronApi?.getAutomationPort) {
      try {
        return this._electronApi.getAutomationPort();
      } catch (error) {
        console.error("[ElectronService] Erro ao obter porta de automação:", error);
        return 3000; // Porta padrão em caso de erro
      }
    }
    return 3000; // Porta padrão caso não esteja no Electron ou função não exista
  }

  // Retorna a plataforma atual (win32, darwin, linux)
  get platform(): string {
    if (this._electronApi?.platform) {
      try {
        return this._electronApi.platform;
      } catch (error) {
        console.error("[ElectronService] Erro ao obter plataforma:", error);
        return "web"; // Plataforma padrão em caso de erro
      }
    }
    // Tenta obter do navigator se não estiver na API
    if (navigator?.platform) {
        return navigator.platform;
    }
    return "web";
  }

  // Obtém as atividades do banco de dados SQLite
  async getActivities(): Promise<any[]> {
    if (this._electronApi?.getActivities) {
      try {
        return await this._electronApi.getActivities();
      } catch (error) {
        console.error("[ElectronService] Erro ao acessar o banco de dados via API:", error);
        return this.getMockActivities(); // Retorna mock em caso de erro
      }
    }
    // Se a função não existe na API ou não é Electron, retorna mock
    return this.getMockActivities();
  }

  // Dados mockados para desenvolvimento e testes (mantido)
  private getMockActivities(): any[] {
    // ... (código mock inalterado)
    return [
      {
        id: 1,
        titulo: "Fundamentos de Python",
        descricao: "Módulo 2: Estruturas de Controle",
        modulo: "Módulo 2",
        disciplina: "Python",
        status: "Concluído",
        nota: 9.5,
        prazo: "2023-05-15"
      },
      {
        id: 2,
        titulo: "Banco de Dados SQL",
        descricao: "Módulo 1: Introdução a Bancos Relacionais",
        modulo: "Módulo 1",
        disciplina: "SQL",
        status: "Pendente",
        nota: null,
        prazo: "2023-05-25"
      },
      {
        id: 3,
        titulo: "Algoritmos e Estruturas de Dados",
        descricao: "Módulo 3: Complexidade de Algoritmos",
        modulo: "Módulo 3",
        disciplina: "Algoritmos",
        status: "Concluído",
        nota: 8.0,
        prazo: "2023-05-10"
      }
    ];
  }

  // Função auxiliar para verificar o ambiente Electron
  private checkIfElectron(): boolean {
    try {
      // 1. Verifica a flag explícita (se o preload a definir)
      if (window && (window as any).electron && (window as any).electron.isElectron === true) {
        console.log("[ElectronService] checkIfElectron: Detectado via 'window.electron.isElectron'.");
        return true;
      }
      // 2. Verifica pelo userAgent
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.indexOf(" electron/") > -1) {
        console.log("[ElectronService] checkIfElectron: Detectado via userAgent.");
        return true;
      }
      // 3. Verifica se a API global 'electron' foi exposta (pode ser definida pelo preload)
      if (window && (window as any).electron) {
        console.log("[ElectronService] checkIfElectron: Detectado via existência de 'window.electron'.");
        return true;
      }
      // 4. Verifica se 'require' está disponível (comum com nodeIntegration=true ou contextIsolation=false)
      if (typeof window.require === "function") {
          try {
              // Tenta carregar um módulo do Electron
              window.require("electron");
              console.log("[ElectronService] checkIfElectron: Detectado via sucesso em window.require('electron').");
              return true;
          } catch (e) {
              // Falha ao carregar, provavelmente não é Electron ou require está bloqueado
          }
      }

      console.log("[ElectronService] checkIfElectron: Nenhuma condição de ambiente Electron detectada.");
      return false;
    } catch (error) {
      console.error("[ElectronService] checkIfElectron: Erro durante a verificação:", error);
      return false;
    }
  }
}

