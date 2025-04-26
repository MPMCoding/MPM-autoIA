import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef, OnDestroy, NgZone } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-navegador',
  templateUrl: './navegador.component.html',
  styleUrls: ['./navegador.component.scss']
})
export class NavegadorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('browserContainer') browserContainerRef!: ElementRef;
  
  url: string = '';
  safeUrl: SafeResourceUrl = '' as SafeResourceUrl;
  isElectron: boolean = true;
  browserHistory: string[] = [];
  currentHistoryIndex: number = -1;
  isAutomationRunning: boolean = false;
  isAutomationPaused: boolean = false;
  automationOutput: string = '';
  resizeObserver: ResizeObserver | null = null;
  
  constructor(
    private electronService: ElectronService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Verifica se está rodando no Electron
    this.isElectron = this.electronService.isElectron;
    console.log('[NavegadorComponent] Constructor - isElectron:', this.isElectron);
  }

  ngOnInit() {
    console.log('[NavegadorComponent] ngOnInit chamado.');
    // Inicialização básica
    this.url = 'https://www.google.com'; // Define uma URL inicial padrão
    this.browserHistory = [this.url];
    this.currentHistoryIndex = 0;
    console.log('[NavegadorComponent] ngOnInit - URL inicial definida:', this.url);
    
    // Configura os listeners para comunicação com o processo principal
    if (this.isElectron) {
      console.log('[NavegadorComponent] ngOnInit - Configurando listeners IPC.');
      this.setupIpcListeners();
    } else {
      console.log('[NavegadorComponent] ngOnInit - Não é Electron, pulando configuração IPC.');
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    }
  }

  ngAfterViewInit() {
    console.log('[NavegadorComponent] ngAfterViewInit chamado.');
    
    // Aguarda um momento para garantir que o DOM esteja completamente renderizado
    // e que as dimensões do contêiner estejam estáveis.
    console.log('[NavegadorComponent] ngAfterViewInit - Agendando inicialização do BrowserView e ResizeObserver (500ms).');
    setTimeout(() => {
      console.log('[NavegadorComponent] ngAfterViewInit - Timeout executado.');
      if (this.isElectron && this.browserContainerRef) {
        console.log('[NavegadorComponent] ngAfterViewInit - Chamando initializeBrowserView().');
        this.initializeBrowserView(); // Solicita a criação/exibição do BrowserView
        
        console.log('[NavegadorComponent] ngAfterViewInit - Chamando setupResizeObserver().');
        this.setupResizeObserver(); // Configura o observer para redimensionamento
      } else {
        console.log('[NavegadorComponent] ngAfterViewInit - Não é Electron ou browserContainerRef não está pronto.');
      }
    }, 500);
  }

  ngOnDestroy() {
    console.log("[NavegadorComponent] ngOnDestroy chamado.");
    // Limpa o observer quando o componente for destruído
    if (this.resizeObserver) {
      console.log("[NavegadorComponent] ngOnDestroy - Desconectando ResizeObserver.");
      this.resizeObserver.disconnect();
      this.resizeObserver = null; // Garante que a referência seja limpa
    }
    // Informa o processo principal para remover/ocultar o BrowserView
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log("[NavegadorComponent] ngOnDestroy - Enviando IPC 'destroy-browser-view'.");
      this.electronService.ipcRenderer.send("destroy-browser-view");
    }
    // Remove listeners IPC para evitar vazamentos de memória
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log("[NavegadorComponent] ngOnDestroy - Removendo listeners IPC.");
      this.electronService.ipcRenderer.removeAllListeners("current-url");
      this.electronService.ipcRenderer.removeAllListeners("browser-page-loaded");
      this.electronService.ipcRenderer.removeAllListeners("browser-error");
      this.electronService.ipcRenderer.removeAllListeners("browser-view-created");
      this.electronService.ipcRenderer.removeAllListeners("automation-status");
      this.electronService.ipcRenderer.removeAllListeners("automation-output");
    }
    console.log("[NavegadorComponent] ngOnDestroy concluído.");
  }

  setupIpcListeners() {
    if (!this.electronService.ipcRenderer) {
      console.error('[NavegadorComponent] setupIpcListeners - ERRO: ipcRenderer não está disponível!');
      return;
    }
    console.log('[NavegadorComponent] setupIpcListeners - Configurando listeners...');

    // Listener para receber a URL atual do BrowserView
    this.electronService.ipcRenderer.on('current-url', (event: any, receivedUrl: string) => {
      this.ngZone.run(() => {
        console.log(`[NavegadorComponent] IPC 'current-url' recebido: ${receivedUrl}`);
        this.url = receivedUrl;
        this.cdr.detectChanges();
      });
    });
    
    // Listener para quando a página é carregada
    this.electronService.ipcRenderer.on('browser-page-loaded', (event: any, loadedUrl: string) => {
      this.ngZone.run(() => {
        console.log(`[NavegadorComponent] IPC 'browser-page-loaded' recebido: ${loadedUrl}`);
        this.url = loadedUrl;
        // Adiciona ao histórico apenas se for diferente da última entrada
        if (this.browserHistory[this.currentHistoryIndex] !== loadedUrl) {
            if (this.currentHistoryIndex < this.browserHistory.length - 1) {
                this.browserHistory = this.browserHistory.slice(0, this.currentHistoryIndex + 1);
            }
            this.browserHistory.push(loadedUrl);
            this.currentHistoryIndex = this.browserHistory.length - 1;
            console.log('[NavegadorComponent] Histórico atualizado:', this.browserHistory, 'Índice:', this.currentHistoryIndex);
        }
        this.cdr.detectChanges();
      });
    });
    
    // Listener para erros de navegação
    this.electronService.ipcRenderer.on('browser-error', (event: any, data: any) => {
      this.ngZone.run(() => {
        console.error('[NavegadorComponent] IPC 'browser-error' recebido:', data);
        // Adicionar feedback visual para o usuário, se necessário
      });
    });
    
    // Listener para confirmação de criação do BrowserView
    this.electronService.ipcRenderer.on('browser-view-created', () => {
      this.ngZone.run(() => {
        console.log('[NavegadorComponent] IPC 'browser-view-created' recebido. Chamando updateBrowserViewBounds().');
        this.updateBrowserViewBounds(); // Envia as coordenadas após a confirmação
      });
    });
    
    // Listeners para status da automação
    this.electronService.ipcRenderer.on('automation-status', (event: any, data: any) => {
      this.ngZone.run(() => {
        console.log('[NavegadorComponent] IPC 'automation-status' recebido:', data);
        if (data.status === 'started') {
          this.isAutomationRunning = true;
          this.isAutomationPaused = false;
        } else if (data.status === 'stopped') {
          this.isAutomationRunning = false;
          this.isAutomationPaused = false;
        } else if (data.status === 'paused') {
          this.isAutomationPaused = true;
        } else if (data.status === 'resumed') {
          this.isAutomationPaused = false;
        }
        this.cdr.detectChanges();
      });
    });
    
    // Listener para saída da automação
    this.electronService.ipcRenderer.on('automation-output', (event: any, data: any) => {
      this.ngZone.run(() => {
        console.log('[NavegadorComponent] IPC 'automation-output' recebido:', data.type);
        this.automationOutput += data.data + '\n';
        this.cdr.detectChanges();
      });
    });
    console.log('[NavegadorComponent] setupIpcListeners - Listeners configurados.');
  }

  // Função para inicializar manualmente (será chamada pelo botão)
  manualInitializeBrowserView() {
      console.log('[NavegadorComponent] manualInitializeBrowserView() chamado pelo botão.');
      if (this.isElectron && this.electronService.ipcRenderer) {
          console.log('[NavegadorComponent] Enviando IPC 'initialize-browser-view' manualmente.');
          this.electronService.ipcRenderer.send('initialize-browser-view');
      } else {
          console.log('[NavegadorComponent] Não é Electron ou ipcRenderer não está pronto para inicialização manual.');
      }
  }

  // Função original de inicialização (chamada no AfterViewInit)
  initializeBrowserView() {
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] initializeBrowserView - Enviando IPC 'initialize-browser-view'.');
      this.electronService.ipcRenderer.send('initialize-browser-view');
    } else {
      console.log('[NavegadorComponent] initializeBrowserView - Não é Electron ou ipcRenderer não está pronto.');
    }
  }

  setupResizeObserver() {
    if (!this.browserContainerRef || !this.browserContainerRef.nativeElement) {
      console.error('[NavegadorComponent] setupResizeObserver - ERRO: Referência do contêiner (browserContainerRef) não encontrada!');
      return;
    }
    console.log('[NavegadorComponent] setupResizeObserver - Configurando ResizeObserver.');
    
    // Cria um observer para monitorar mudanças de tamanho no contêiner
    this.resizeObserver = new ResizeObserver((entries) => {
      // Usamos NgZone para garantir que as atualizações ocorram dentro da zona do Angular
      this.ngZone.run(() => {
        for (let entry of entries) {
            console.log('[NavegadorComponent] ResizeObserver - Contêiner redimensionado. Chamando updateBrowserViewBounds().');
            this.updateBrowserViewBounds();
        }
      });
    });
    
    // Inicia a observação do elemento
    console.log('[NavegadorComponent] setupResizeObserver - Iniciando observação do contêiner.');
    this.resizeObserver.observe(this.browserContainerRef.nativeElement);
    
    // Atualiza as coordenadas iniciais uma vez após a configuração
    console.log('[NavegadorComponent] setupResizeObserver - Chamando updateBrowserViewBounds() inicialmente.');
    this.updateBrowserViewBounds();
  }

  updateBrowserViewBounds() {
    if (!this.isElectron || !this.browserContainerRef || !this.browserContainerRef.nativeElement || !this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] updateBrowserViewBounds - Abortando: Não é Electron, contêiner não pronto ou ipcRenderer indisponível.');
      return;
    }
    
    const container = this.browserContainerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    
    // Obtém as coordenadas do contêiner em relação à viewport da janela
    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    
    // Verifica se as dimensões são válidas antes de enviar
    if (bounds.width > 0 && bounds.height > 0) {
        console.log(`[NavegadorComponent] updateBrowserViewBounds - Enviando IPC 'set-browser-view-bounds': ${JSON.stringify(bounds)}`);
        this.electronService.ipcRenderer.send('set-browser-view-bounds', bounds);
    } else {
        console.warn(`[NavegadorComponent] updateBrowserViewBounds - Dimensões inválidas detectadas (${bounds.width}x${bounds.height}), não enviando coordenadas.`);
    }
  }

  navigateToUrl(urlInput: string) {
    console.log(`[NavegadorComponent] navigateToUrl chamado com: ${urlInput}`);
    let targetUrl = urlInput.trim();
    if (!targetUrl) {
        console.log('[NavegadorComponent] navigateToUrl - URL vazia, ignorando.');
        return;
    }
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
      console.log(`[NavegadorComponent] navigateToUrl - URL ajustada para: ${targetUrl}`);
    }
    
    this.url = targetUrl; // Atualiza a barra de endereço imediatamente
    
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log(`[NavegadorComponent] navigateToUrl - Enviando IPC 'navigate-to-url': ${targetUrl}`);
      this.electronService.ipcRenderer.send('navigate-to-url', targetUrl);
      // O histórico será atualizado pelo listener 'browser-page-loaded'
    } else {
      console.log('[NavegadorComponent] navigateToUrl - Não é Electron, usando SafeResourceUrl.');
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
    console.log('[NavegadorComponent] goBack chamado.');
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] goBack - Enviando IPC 'browser-back'.');
      this.electronService.ipcRenderer.send('browser-back');
    } else if (this.currentHistoryIndex > 0) {
      console.log('[NavegadorComponent] goBack - Navegando no histórico local (não-Electron).');
      this.currentHistoryIndex--;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    } else {
      console.log('[NavegadorComponent] goBack - Não é possível voltar.');
    }
  }

  goForward() {
    console.log('[NavegadorComponent] goForward chamado.');
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] goForward - Enviando IPC 'browser-forward'.');
      this.electronService.ipcRenderer.send('browser-forward');
    } else if (this.currentHistoryIndex < this.browserHistory.length - 1) {
      console.log('[NavegadorComponent] goForward - Navegando no histórico local (não-Electron).');
      this.currentHistoryIndex++;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    } else {
      console.log('[NavegadorComponent] goForward - Não é possível avançar.');
    }
  }

  reload() {
    console.log('[NavegadorComponent] reload chamado.');
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] reload - Enviando IPC 'browser-reload'.');
      this.electronService.ipcRenderer.send('browser-reload');
    } else {
      console.log('[NavegadorComponent] reload - Recarregando via SafeResourceUrl (não-Electron).');
      const currentUrl = this.url;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(''); // Limpa para forçar recarga
      setTimeout(() => {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(currentUrl);
      }, 50); // Pequeno delay
    }
  }

  startAutomation() {
    console.log('[NavegadorComponent] startAutomation chamado.');
    if (this.isElectron && !this.isAutomationRunning && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] startAutomation - Enviando IPC 'start-automation'.');
      this.electronService.ipcRenderer.send('start-automation');
    } else {
      console.log('[NavegadorComponent] startAutomation - Não iniciado (Não é Electron, já rodando ou ipcRenderer indisponível).');
    }
  }

  stopAutomation() {
    console.log('[NavegadorComponent] stopAutomation chamado.');
    if (this.isElectron && this.isAutomationRunning && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] stopAutomation - Enviando IPC 'stop-automation'.');
      this.electronService.ipcRenderer.send('stop-automation');
    } else {
      console.log('[NavegadorComponent] stopAutomation - Não parado (Não é Electron, não rodando ou ipcRenderer indisponível).');
    }
  }

  pauseResumeAutomation() {
    console.log('[NavegadorComponent] pauseResumeAutomation chamado.');
    if (this.isElectron && this.isAutomationRunning && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] pauseResumeAutomation - Enviando IPC 'pause-automation'.');
      this.electronService.ipcRenderer.send('pause-automation');
    } else {
      console.log('[NavegadorComponent] pauseResumeAutomation - Não pausado/resumido (Não é Electron, não rodando ou ipcRenderer indisponível).');
    }
  }

  onUrlKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      console.log('[NavegadorComponent] onUrlKeyDown - Enter pressionado.');
      // Garante que o valor do input seja pego
      const target = event.target as HTMLInputElement;
      this.navigateToUrl(target.value);
    }
  }

  toggleDevTools() {
    console.log('[NavegadorComponent] toggleDevTools chamado.');
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log('[NavegadorComponent] toggleDevTools - Enviando IPC 'toggle-devtools'.');
      this.electronService.ipcRenderer.send('toggle-devtools');
    }
  }
}

