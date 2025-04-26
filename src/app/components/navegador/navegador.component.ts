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
    console.log('Navegador inicializado, isElectron:', this.isElectron);
  }

  ngOnInit() {
    // Inicialização básica
    this.url = 'https://www.google.com';
    this.browserHistory = [this.url];
    this.currentHistoryIndex = 0;
    console.log('URL inicial definida como:', this.url);
    
    // Configura os listeners para comunicação com o processo principal
    if (this.isElectron) {
      this.setupIpcListeners();
    }
  }

  ngAfterViewInit() {
    console.log('ngAfterViewInit chamado');
    // A inicialização do BrowserView agora é acionada pelo componente pai ou serviço após o login.
    // A configuração do ResizeObserver será feita após a confirmação da criação do BrowserView.
  }

  ngOnDestroy() {
    // Limpa o observer quando o componente for destruído
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  setupIpcListeners() {
    if (!this.electronService.ipcRenderer) {
      console.error('ipcRenderer não está disponível');
      return;
    }

    // Listener para receber a URL atual do BrowserView
    this.electronService.ipcRenderer.on('current-url', (event: any, url: string) => {
      this.ngZone.run(() => {
        this.url = url;
        this.cdr.detectChanges();
      });
    });
    
    // Listener para quando a página é carregada
    this.electronService.ipcRenderer.on('browser-page-loaded', (event: any, url: string) => {
      this.ngZone.run(() => {
        this.url = url;
        this.cdr.detectChanges();
      });
    });
    
    // Listener para erros de navegação
    this.electronService.ipcRenderer.on('browser-error', (event: any, data: any) => {
      console.error('Erro de navegação:', data);
    });
    
    // Listener para confirmação de criação do BrowserView
    this.electronService.ipcRenderer.on('browser-view-created', () => {
      console.log('BrowserView criado, enviando coordenadas');
      this.updateBrowserViewBounds();
    });
    
    // Listeners para status da automação
    this.electronService.ipcRenderer.on('automation-status', (event: any, data: any) => {
      this.ngZone.run(() => {
        console.log('Status da automação:', data);
        
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
        this.automationOutput += data.data + '\n';
        this.cdr.detectChanges();
      });
    });
  }

  initializeBrowserView() {
    if (this.isElectron && this.electronService.ipcRenderer) {
      console.log('Solicitando inicialização do BrowserView');
      this.electronService.ipcRenderer.send('initialize-browser-view');
    }
  }

  setupResizeObserver() {
    if (!this.browserContainerRef || !this.browserContainerRef.nativeElement) {
      console.error('Referência do contêiner não encontrada');
      return;
    }
    
    // Cria um observer para monitorar mudanças de tamanho no contêiner
    this.resizeObserver = new ResizeObserver(() => {
      this.updateBrowserViewBounds();
    });
    
    // Inicia a observação do elemento
    this.resizeObserver.observe(this.browserContainerRef.nativeElement);
    
    // Atualiza as coordenadas iniciais
    this.updateBrowserViewBounds();
  }

  updateBrowserViewBounds() {
    if (!this.isElectron || !this.browserContainerRef || !this.browserContainerRef.nativeElement || !this.electronService.ipcRenderer) {
      return;
    }
    
    const container = this.browserContainerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    
    // Obtém as coordenadas do contêiner em relação à janela
    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    
    console.log('Enviando coordenadas do contêiner:', bounds);
    this.electronService.ipcRenderer.send('set-browser-view-bounds', bounds);
  }

  navigateToUrl(url: string) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    this.url = url;
    
    if (this.isElectron && this.electronService.ipcRenderer) {
      // Envia a URL para o processo principal carregar no BrowserView
      this.electronService.ipcRenderer.send('navigate-to-url', url);
      
      // Atualiza o histórico
      if (this.currentHistoryIndex < this.browserHistory.length - 1) {
        // Se estamos no meio do histórico, remove os itens à frente
        this.browserHistory = this.browserHistory.slice(0, this.currentHistoryIndex + 1);
      }
      
      this.browserHistory.push(url);
      this.currentHistoryIndex = this.browserHistory.length - 1;
    } else {
      // Fallback para navegadores normais (não Electron)
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
  }

  goBack() {
    if (this.isElectron && this.electronService.ipcRenderer) {
      this.electronService.ipcRenderer.send('browser-back');
    } else if (this.currentHistoryIndex > 0) {
      this.currentHistoryIndex--;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    }
  }

  goForward() {
    if (this.isElectron && this.electronService.ipcRenderer) {
      this.electronService.ipcRenderer.send('browser-forward');
    } else if (this.currentHistoryIndex < this.browserHistory.length - 1) {
      this.currentHistoryIndex++;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    }
  }

  reload() {
    if (this.isElectron && this.electronService.ipcRenderer) {
      this.electronService.ipcRenderer.send('browser-reload');
    } else {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl('');
      setTimeout(() => {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
      }, 100);
    }
  }

  startAutomation() {
    if (this.isElectron && !this.isAutomationRunning && this.electronService.ipcRenderer) {
      this.electronService.ipcRenderer.send('start-automation');
    }
  }

  stopAutomation() {
    if (this.isElectron && this.isAutomationRunning && this.electronService.ipcRenderer) {
      this.electronService.ipcRenderer.send('stop-automation');
    }
  }

  pauseResumeAutomation() {
    if (this.isElectron && this.isAutomationRunning && this.electronService.ipcRenderer) {
      this.electronService.ipcRenderer.send('pause-automation');
    }
  }

  onUrlKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.navigateToUrl(this.url);
    }
  }
}
