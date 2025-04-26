import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-navegador',
  templateUrl: './navegador.component.html',
  styleUrls: ['./navegador.component.scss']
})
export class NavegadorComponent implements OnInit, AfterViewInit {
  @ViewChild('browserFrame') browserFrameRef!: ElementRef;
  url: string = 'https://www.google.com';
  safeUrl: SafeResourceUrl;
  isElectron: boolean = false;
  automationPort: number = 3000;
  isLoading: boolean = false;
  canGoBack: boolean = false;
  canGoForward: boolean = false;
  isAutomationRunning: boolean = false;
  isPaused: boolean = false;
  browserHistory: string[] = [];
  currentHistoryIndex: number = -1;

  constructor(
    private electronService: ElectronService,
    private sanitizer: DomSanitizer
  ) {
    this.isElectron = this.electronService.isElectron;
    if (this.isElectron) {
      this.automationPort = this.electronService.automationPort;
    }
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    console.log('Navegador inicializado com URL:', this.url);
  }

  ngOnInit() {
    // Define a URL inicial como um site que permite ser carregado em iframe
    this.url = 'https://example.com';
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    this.browserHistory = [this.url];
    this.currentHistoryIndex = 0;
    console.log('URL inicial definida como:', this.url);
  }

  ngAfterViewInit() {
    console.log('ngAfterViewInit chamado');
    if (this.browserFrameRef) {
      console.log('Referência do iframe obtida');
      
      // Adiciona evento de carregamento ao iframe
      const iframe = this.browserFrameRef.nativeElement;
      iframe.onload = () => {
        console.log('Iframe carregado:', this.url);
        this.isLoading = false;
        
        // Atualiza o histórico apenas se for uma nova URL
        if (this.browserHistory[this.currentHistoryIndex] !== this.url) {
          // Remove entradas futuras se estamos navegando a partir de um ponto no histórico
          this.browserHistory = this.browserHistory.slice(0, this.currentHistoryIndex + 1);
          this.browserHistory.push(this.url);
          this.currentHistoryIndex = this.browserHistory.length - 1;
        }
        
        this.updateNavigationState();
      };
      
      iframe.onerror = (error: any) => {
        console.error('Erro ao carregar iframe:', error);
        this.isLoading = false;
      };
    } else {
      console.error('Referência do iframe não disponível');
    }
  }

  // Atualiza o estado dos botões de navegação
  updateNavigationState() {
    this.canGoBack = this.currentHistoryIndex > 0;
    this.canGoForward = this.currentHistoryIndex < this.browserHistory.length - 1;
    console.log('Estado de navegação atualizado - Voltar:', this.canGoBack, 'Avançar:', this.canGoForward);
  }

  // Navega para a URL especificada
  navigate() {
    console.log('Navegando para:', this.url);
    this.isLoading = true;
    
    // Adiciona https:// se não estiver presente
    if (!this.url.startsWith('http://') && !this.url.startsWith('https://')) {
      this.url = 'https://' + this.url;
    }
    
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
  }

  // Recarrega a página atual
  reload() {
    console.log('Recarregando página atual');
    this.isLoading = true;
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    
    // Pequeno atraso para garantir que o iframe seja recarregado
    setTimeout(() => {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    }, 100);
  }

  // Navega para trás no histórico
  goBack() {
    if (this.canGoBack) {
      console.log('Navegando para trás no histórico');
      this.isLoading = true;
      this.currentHistoryIndex--;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
      this.updateNavigationState();
    }
  }

  // Navega para frente no histórico
  goForward() {
    if (this.canGoForward) {
      console.log('Navegando para frente no histórico');
      this.isLoading = true;
      this.currentHistoryIndex++;
      this.url = this.browserHistory[this.currentHistoryIndex];
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
      this.updateNavigationState();
    }
  }

  // Inicia a automação Python
  startAutomation() {
    if (this.isElectron) {
      console.log('Iniciando automação na URL:', this.url);
      this.isAutomationRunning = true;
      this.isPaused = false;
      
      // Aqui vamos chamar o script Python através do IPC
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('start-automation', {
        url: this.url
      });
    } else {
      console.warn('Automação só está disponível no ambiente Electron');
    }
  }

  // Para a automação Python
  stopAutomation() {
    if (this.isElectron) {
      console.log('Parando automação');
      this.isAutomationRunning = false;
      this.isPaused = false;
      
      // Aqui vamos enviar o comando para parar o script Python
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('stop-automation');
    }
  }

  // Pausa/Continua a automação Python
  togglePauseAutomation() {
    if (this.isElectron && this.isAutomationRunning) {
      this.isPaused = !this.isPaused;
      console.log(this.isPaused ? 'Pausando automação' : 'Continuando automação');
      
      // Aqui vamos enviar o comando para pausar/continuar o script Python
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('toggle-pause-automation', { paused: this.isPaused });
    }
  }
}
