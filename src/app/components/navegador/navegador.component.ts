import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, OnDestroy, NgZone } from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { ElectronService } from "../../services/electron.service";
import { DatabaseService } from "../../services/database.service";

// Interface para o IPC Renderer (importada ou definida aqui se necessário)
interface IpcRenderer {
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  removeListener: (channel: string, listener: Function) => void;
  removeAllListeners: (channel: string) => void;
}

@Component({
  selector: "app-navegador",
  templateUrl: "./navegador.component.html",
  styleUrls: ["./navegador.component.scss"]
})
export class NavegadorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("browserContainer") browserContainerRef!: ElementRef;
  
  url: string = "";
  safeUrl: SafeResourceUrl = "" as SafeResourceUrl;
  isElectron: boolean = false; // Inicializa como false, será verificado
  ipcAvailable: boolean = false; // Flag para disponibilidade do IPC
  browserViewInitialized: boolean = false; // Flag para saber se o BV foi inicializado
  errorMessage: string | null = null; // Para exibir erros na UI

  browserHistory: string[] = [];
  currentHistoryIndex: number = -1;
  isAutomationRunning: boolean = false;
  isAutomationPaused: boolean = false;
  automationOutput: string = "";
  resizeObserver: ResizeObserver | null = null;
  
  private ipcRenderer: IpcRenderer | null = null; // Armazena localmente para fácil acesso

  constructor(
    private electronService: ElectronService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private databaseService: DatabaseService
  ) {
    console.log("[NavegadorComponent] Constructor - Verificando ambiente Electron e IPC.");
    this.isElectron = this.electronService.isElectron;
    this.ipcRenderer = this.electronService.ipcRenderer; // Tenta obter o ipcRenderer
    this.ipcAvailable = !!this.ipcRenderer; // Define a flag de disponibilidade
    console.log(`[NavegadorComponent] Constructor - isElectron: ${this.isElectron}, ipcAvailable: ${this.ipcAvailable}`);
    if (!this.ipcAvailable && this.isElectron) {
        this.errorMessage = "Erro crítico: A comunicação com o processo principal do Electron (IPC) falhou. O navegador não funcionará.";
        console.error("[NavegadorComponent] Constructor - IPC Renderer não está disponível!");
    }
  }

  ngOnInit() {
    console.log("[NavegadorComponent] ngOnInit chamado.");
    this.url = "https://www.google.com"; // URL inicial padrão
    this.browserHistory = [this.url];
    this.currentHistoryIndex = 0;
    console.log("[NavegadorComponent] ngOnInit - URL inicial definida:", this.url);
    
    if (this.ipcAvailable) {
      console.log("[NavegadorComponent] ngOnInit - Configurando listeners IPC.");
      this.setupIpcListeners();
    } else if (!this.isElectron) {
      console.log("[NavegadorComponent] ngOnInit - Não é Electron, usando iframe fallback.");
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    } else {
        console.warn("[NavegadorComponent] ngOnInit - É Electron, mas IPC não está disponível. Listeners não configurados.");
    }
  }

  ngAfterViewInit() {
    console.log("[NavegadorComponent] ngAfterViewInit chamado.");
    if (this.ipcAvailable && this.browserContainerRef) {
      console.log("[NavegadorComponent] ngAfterViewInit - Agendando inicialização do BrowserView e ResizeObserver (500ms).");
      // Usar timeout pode ser necessário se as dimensões do container não estiverem prontas imediatamente
      setTimeout(() => {
        console.log("[NavegadorComponent] ngAfterViewInit - Timeout executado.");
        if (this.ipcAvailable) { // Verifica novamente, caso algo tenha mudado
            console.log("[NavegadorComponent] ngAfterViewInit - Chamando initializeBrowserView().");
            this.initializeBrowserView();
            console.log("[NavegadorComponent] ngAfterViewInit - Chamando setupResizeObserver().");
            this.setupResizeObserver();
        } else {
             console.warn("[NavegadorComponent] ngAfterViewInit - Timeout: IPC se tornou indisponível.");
             this.errorMessage = "Falha ao inicializar o navegador: comunicação IPC perdida.";
             this.cdr.detectChanges();
        }
      }, 500);
    } else if (this.isElectron) {
        console.warn("[NavegadorComponent] ngAfterViewInit - IPC indisponível ou contêiner não pronto. BrowserView não será inicializado automaticamente.");
        if (!this.browserContainerRef) {
            this.errorMessage = "Erro interno: Contêiner do navegador não encontrado.";
        }
        this.cdr.detectChanges();
    } else {
        console.log("[NavegadorComponent] ngAfterViewInit - Não é Electron.");
    }
  }

  ngOnDestroy() {
    console.log("[NavegadorComponent] ngOnDestroy chamado.");
    if (this.resizeObserver) {
      console.log("[NavegadorComponent] ngOnDestroy - Desconectando ResizeObserver.");
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.ipcAvailable && this.ipcRenderer) {
      console.log("[NavegadorComponent] ngOnDestroy - Enviando IPC 'destroy-browser-view'.");
      this.ipcRenderer.send("destroy-browser-view");
      console.log("[NavegadorComponent] ngOnDestroy - Removendo listeners IPC.");
      this.ipcRenderer.removeAllListeners("current-url");
      this.ipcRenderer.removeAllListeners("browser-page-loaded");
      this.ipcRenderer.removeAllListeners("browser-error");
      this.ipcRenderer.removeAllListeners("browser-view-created");
      this.ipcRenderer.removeAllListeners("automation-status");
      this.ipcRenderer.removeAllListeners("automation-output");
      this.ipcRenderer.removeAllListeners("save-question-answer");
      this.browserViewInitialized = false; // Marca como não inicializado
    } else {
        console.log("[NavegadorComponent] ngOnDestroy - IPC indisponível, pulando limpeza IPC.");
    }
    console.log("[NavegadorComponent] ngOnDestroy concluído.");
  }

  setupIpcListeners() {
    // A verificação já foi feita no ngOnInit, mas uma dupla verificação não custa
    if (!this.ipcRenderer) {
      console.error("[NavegadorComponent] setupIpcListeners - ERRO FATAL: Tentativa de configurar listeners sem ipcRenderer!");
      this.ipcAvailable = false;
      this.errorMessage = "Erro crítico: Comunicação IPC perdida durante a configuração.";
      this.cdr.detectChanges();
      return;
    }
    console.log("[NavegadorComponent] setupIpcListeners - Configurando listeners...");

    this.ipcRenderer.on("current-url", (event: any, receivedUrl: string) => {
      this.ngZone.run(() => {
        console.log(`[NavegadorComponent] IPC "current-url" recebido: ${receivedUrl}`);
        this.url = receivedUrl;
        this.cdr.detectChanges();
      });
    });
    
    this.ipcRenderer.on("browser-page-loaded", (event: any, loadedUrl: string) => {
      this.ngZone.run(() => {
        console.log(`[NavegadorComponent] IPC "browser-page-loaded" recebido: ${loadedUrl}`);
        this.url = loadedUrl;
        if (this.browserHistory[this.currentHistoryIndex] !== loadedUrl) {
            if (this.currentHistoryIndex < this.browserHistory.length - 1) {
                this.browserHistory = this.browserHistory.slice(0, this.currentHistoryIndex + 1);
            }
            this.browserHistory.push(loadedUrl);
            this.currentHistoryIndex = this.browserHistory.length - 1;
            console.log("[NavegadorComponent] Histórico atualizado:", this.browserHistory, "Índice:", this.currentHistoryIndex);
        }
        this.cdr.detectChanges();
      });
    });
    
    this.ipcRenderer.on("browser-error", (event: any, data: any) => {
      this.ngZone.run(() => {
        console.error("[NavegadorComponent] IPC browser-error recebido:", data);
        this.errorMessage = `Erro de navegação: ${data.errorCode} - ${data.errorDescription}`;
        this.cdr.detectChanges();
      });
    });
    
    this.ipcRenderer.on("browser-view-created", () => {
      this.ngZone.run(() => {
        console.log("[NavegadorComponent] IPC browser-view-created recebido. Marcando como inicializado e chamando updateBrowserViewBounds().");
        this.browserViewInitialized = true;
        this.errorMessage = null; // Limpa mensagens de erro anteriores
        this.updateBrowserViewBounds();
        this.cdr.detectChanges(); // Atualiza a UI (ex: desabilitar botão init)
      });
    });
    
    this.ipcRenderer.on("automation-status", (event: any, data: any) => {
      this.ngZone.run(() => {
        console.log("[NavegadorComponent] IPC automation-status recebido:", data);
        if (data.status === "started") {
          this.isAutomationRunning = true;
          this.isAutomationPaused = false;
        } else if (data.status === "stopped") {
          this.isAutomationRunning = false;
          this.isAutomationPaused = false;
        } else if (data.status === "paused") {
          this.isAutomationPaused = true;
        } else if (data.status === "resumed") {
          this.isAutomationPaused = false;
        }
        this.cdr.detectChanges();
      });
    });
    
    this.ipcRenderer.on("automation-output", (event: any, data: any) => {
      this.ngZone.run(() => {
        console.log("[NavegadorComponent] IPC automation-output recebido:", data.type);
        this.automationOutput += data.data + "\n";
        this.cdr.detectChanges();
      });
    });
    
    // Handler para salvar perguntas e respostas no banco de dados
    this.ipcRenderer.on("save-question-answer", (event: any, data: any) => {
      this.ngZone.run(async () => {
        console.log("[NavegadorComponent] IPC save-question-answer recebido:", data);
        try {
          // Extrai a pergunta, resposta e metadados
          const { pergunta, resposta, disciplina, modulo } = data;
          
          // Salva no banco de dados usando o DatabaseService
          const success = await this.databaseService.savePergunta(pergunta, resposta, disciplina, modulo);
          
          // Envia resposta de volta para o processo principal
          if (this.ipcRenderer) {
            this.ipcRenderer.send("save-question-answer-result", { success });
          }
          
          console.log("[NavegadorComponent] Pergunta e resposta salvas com sucesso:", success);
        } catch (error) {
          console.error("[NavegadorComponent] Erro ao salvar pergunta e resposta:", error);
          // Envia resposta de erro de volta para o processo principal
          if (this.ipcRenderer) {
            this.ipcRenderer.send("save-question-answer-result", { 
              success: false, 
              error: error instanceof Error ? error.message : String(error) 
            });
          }
        }
      });
    });
    }

  goHome() {
      console.log('[NavegadorComponent] goHome() chamado pelo botão Home.');
      const googleUrl = 'https://www.google.com';
      
      if (this.isElectron) {
          if (!this.browserViewInitialized) {
              console.log('[NavegadorComponent] BrowserView não inicializado. Inicializando primeiro...');
              // Inicializa o BrowserView se ainda não estiver inicializado
              if (this.ipcAvailable && this.ipcRenderer) {
                  this.ipcRenderer.send('initialize-browser-view');
                  // Aguarda um pouco para dar tempo de inicializar antes de navegar
                  setTimeout(() => {
                      this.navigateToUrl(googleUrl);
                  }, 300);
              } else {
                  console.error('[NavegadorComponent] ERRO: Tentativa de navegação sem IPC disponível!');
                  this.errorMessage = 'Não é possível navegar: Comunicação IPC indisponível.';
                  this.cdr.detectChanges();
              }
          } else {
              // BrowserView já inicializado, apenas navega para o Google
              this.navigateToUrl(googleUrl);
          }
      } else {
          // Fallback para ambiente não-Electron
          this.url = googleUrl;
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(googleUrl);
          this.cdr.detectChanges();
      }
  }

  initializeBrowserView() {
    if (this.ipcAvailable && this.ipcRenderer) {
      console.log('[NavegadorComponent] initializeBrowserView - Enviando IPC initialize-browser-view.');
      this.ipcRenderer.send('initialize-browser-view');
    } else {
      console.warn('[NavegadorComponent] initializeBrowserView - IPC indisponível. BrowserView não será inicializado.');
      // A mensagem de erro já deve ter sido definida no constructor ou ngOnInit
    }
  }

  setupResizeObserver() {
    if (!this.browserContainerRef || !this.browserContainerRef.nativeElement) {
      console.error('[NavegadorComponent] setupResizeObserver - ERRO: Referência do contêiner (browserContainerRef) não encontrada!');
      this.errorMessage = 'Erro interno: Falha ao observar redimensionamento do contêiner.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.ipcAvailable) {
        console.warn('[NavegadorComponent] setupResizeObserver - IPC indisponível, observador não será configurado.');
        return;
    }
    console.log('[NavegadorComponent] setupResizeObserver - Configurando ResizeObserver.');
    
    this.resizeObserver = new ResizeObserver((entries) => {
      this.ngZone.run(() => {
        for (let entry of entries) {
            // Verifica se o BV foi inicializado antes de enviar bounds
            if (this.browserViewInitialized) {
                console.log('[NavegadorComponent] ResizeObserver - Contêiner redimensionado. Chamando updateBrowserViewBounds().');
                this.updateBrowserViewBounds();
            } else {
                console.log('[NavegadorComponent] ResizeObserver - Contêiner redimensionado, mas BrowserView não inicializado. Bounds não enviados.');
            }
        }
      });
    });
    
    console.log('[NavegadorComponent] setupResizeObserver - Iniciando observação do contêiner.');
    this.resizeObserver.observe(this.browserContainerRef.nativeElement);
    
    // Atualiza as coordenadas iniciais se o BV já estiver pronto (pouco provável aqui, mas seguro)
    if (this.browserViewInitialized) {
        console.log('[NavegadorComponent] setupResizeObserver - Chamando updateBrowserViewBounds() inicialmente (BV já estava pronto).');
        this.updateBrowserViewBounds();
    }
  }

  updateBrowserViewBounds() {
    if (!this.ipcAvailable || !this.ipcRenderer || !this.browserContainerRef?.nativeElement) {
      console.warn('[NavegadorComponent] updateBrowserViewBounds - Abortando: IPC indisponível ou contêiner não pronto.');
      return;
    }
    // Verifica se o BV foi confirmado como criado antes de enviar bounds
    if (!this.browserViewInitialized) {
        console.warn('[NavegadorComponent] updateBrowserViewBounds - Abortando: BrowserView ainda não confirmado como criado.');
        return;
    }
    
    const container = this.browserContainerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    
    if (bounds.width > 0 && bounds.height > 0) {
        console.log(`[NavegadorComponent] updateBrowserViewBounds - Enviando IPC 'set-browser-view-bounds': ${JSON.stringify(bounds)}`);
        this.ipcRenderer.send('set-browser-view-bounds', bounds);
    } else {
        console.warn(`[NavegadorComponent] updateBrowserViewBounds - Dimensões inválidas detectadas (${bounds.width}x${bounds.height}), não enviando coordenadas.`);
    }
  }

  // --- Métodos de Navegação e Automação com Verificação IPC --- 

  private sendIpcMessage(channel: string, ...args: any[]) {
      if (this.ipcAvailable && this.ipcRenderer) {
          console.log(`[NavegadorComponent] Enviando IPC "${channel}" com args:`, args);
          this.ipcRenderer.send(channel, ...args);
          return true;
      } else {
          console.error(`[NavegadorComponent] ERRO: Tentativa de enviar IPC "${channel}" sem IPC disponível!`);
          this.errorMessage = "Falha na comunicação com o navegador interno (IPC indisponível).";
          this.cdr.detectChanges();
          return false;
      }
  }

  navigateToUrl(urlInput: string) {
    console.log(`[NavegadorComponent] navigateToUrl chamado com: ${urlInput}`);
    let targetUrl = urlInput.trim();
    if (!targetUrl) {
        console.log("[NavegadorComponent] navigateToUrl - URL vazia, ignorando.");
        return;
    }
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
      console.log(`[NavegadorComponent] navigateToUrl - URL ajustada para: ${targetUrl}`);
    }
    
    this.url = targetUrl;
    
    if (this.isElectron) {
        if (!this.browserViewInitialized) {
            console.warn("[NavegadorComponent] navigateToUrl - BrowserView não inicializado. Tentando inicializar primeiro.");
            this.initializeBrowserView(); // Tenta inicializar se não estiver
            // Idealmente, deveria esperar a confirmação antes de navegar, mas isso complica a UX.
            // Por agora, apenas envia o comando de navegação após a tentativa de inicialização.
            setTimeout(() => this.sendIpcMessage("navigate-to-url", targetUrl), 100); // Pequeno delay
        } else {
            this.sendIpcMessage("navigate-to-url", targetUrl);
        }
    } else {
      console.log("[NavegadorComponent] navigateToUrl - Não é Electron, usando SafeResourceUrl.");
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(targetUrl);
      // Atualiza histórico local para não-Electron
      if (this.currentHistoryIndex < this.browserHistory.length - 1) {
        this.browserHistory = this.browserHistory.slice(0, this.currentHistoryIndex + 1);
      }
      this.browserHistory.push(targetUrl);
      this.currentHistoryIndex = this.browserHistory.length - 1;
    }
  }

  goBack() {
    console.log("[NavegadorComponent] goBack chamado.");
    if (this.isElectron) {
        if (this.browserViewInitialized) {
            this.sendIpcMessage("browser-back");
        } else {
            console.warn("[NavegadorComponent] goBack - BrowserView não inicializado.");
        }
    } else if (this.currentHistoryIndex > 0) {
      console.log("[NavegadorComponent] goBack - Navegando no histórico local (não-Electron).");
      this.currentHistoryIndex--;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    } else {
      console.log("[NavegadorComponent] goBack - Não é possível voltar.");
    }
  }

  goForward() {
    console.log("[NavegadorComponent] goForward chamado.");
    if (this.isElectron) {
        if (this.browserViewInitialized) {
            this.sendIpcMessage("browser-forward");
        } else {
            console.warn("[NavegadorComponent] goForward - BrowserView não inicializado.");
        }
    } else if (this.currentHistoryIndex < this.browserHistory.length - 1) {
      console.log("[NavegadorComponent] goForward - Navegando no histórico local (não-Electron).");
      this.currentHistoryIndex++;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    } else {
      console.log("[NavegadorComponent] goForward - Não é possível avançar.");
    }
  }

  reload() {
    console.log("[NavegadorComponent] reload chamado.");
    if (this.isElectron) {
        if (this.browserViewInitialized) {
            this.sendIpcMessage("browser-reload");
        } else {
            console.warn("[NavegadorComponent] reload - BrowserView não inicializado.");
        }
    } else {
      console.log("[NavegadorComponent] reload - Recarregando via SafeResourceUrl (não-Electron).");
      const currentUrl = this.url;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl("");
      setTimeout(() => {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(currentUrl);
      }, 50);
    }
  }

  startAutomation() {
    console.log("[NavegadorComponent] startAutomation chamado.");
    if (this.isElectron && !this.isAutomationRunning) {
        if (this.browserViewInitialized) {
            this.sendIpcMessage("start-automation");
        } else {
            console.warn("[NavegadorComponent] startAutomation - BrowserView não inicializado.");
            this.errorMessage = "Inicialize o navegador antes de iniciar a automação.";
            this.cdr.detectChanges();
        }
    } else {
      console.log("[NavegadorComponent] startAutomation - Não iniciado (Não é Electron ou já rodando).");
    }
  }

  stopAutomation() {
    console.log("[NavegadorComponent] stopAutomation chamado.");
    if (this.isElectron && this.isAutomationRunning) {
        // Não depende do BV estar inicializado para parar, apenas do IPC
        this.sendIpcMessage("stop-automation");
    } else {
      console.log("[NavegadorComponent] stopAutomation - Não parado (Não é Electron ou não rodando).");
    }
  }

  pauseResumeAutomation() {
    console.log("[NavegadorComponent] pauseResumeAutomation chamado.");
    if (this.isElectron && this.isAutomationRunning) {
        // Não depende do BV estar inicializado para pausar/resumir, apenas do IPC
        this.sendIpcMessage("pause-automation");
    } else {
      console.log("[NavegadorComponent] pauseResumeAutomation - Não pausado/resumido (Não é Electron ou não rodando).");
    }
  }

  onUrlKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      console.log("[NavegadorComponent] onUrlKeyDown - Enter pressionado.");
      const target = event.target as HTMLInputElement;
      this.navigateToUrl(target.value);
    }
  }

  toggleDevTools() {
    console.log("[NavegadorComponent] toggleDevTools chamado.");
    // Envia mesmo se o BV não estiver inicializado, pode abrir o DevTools da janela principal
    this.sendIpcMessage("toggle-devtools");
  }
}

