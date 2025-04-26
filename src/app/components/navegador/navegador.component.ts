import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-navegador',
  templateUrl: './navegador.component.html',
  styleUrls: ['./navegador.component.scss']
})
export class NavegadorComponent implements OnInit, AfterViewInit {
  @ViewChild('webview') webviewRef!: ElementRef;
  url: string = 'https://www.google.com';
  isElectron: boolean = false;
  automationPort: number = 3000;
  isLoading: boolean = false;
  canGoBack: boolean = false;
  canGoForward: boolean = false;
  isAutomationRunning: boolean = false;
  isPaused: boolean = false;

  constructor(private electronService: ElectronService) {
    // Forçar isElectron para true em ambiente de desenvolvimento
    this.isElectron = true; // Sempre assume que está no Electron
    console.log('Estado isElectron definido como:', this.isElectron);
    
    if (this.electronService.isElectron) {
      this.automationPort = this.electronService.automationPort;
    }
  }

  ngOnInit() {
    // Define a URL inicial como Google
    this.url = 'https://www.google.com';
    console.log('URL inicial definida como:', this.url);
  }

  ngAfterViewInit() {
    console.log('ngAfterViewInit chamado, isElectron:', this.isElectron);
    console.log('webviewRef existe:', !!this.webviewRef);
    
    // Pequeno atraso para garantir que o DOM esteja totalmente carregado
    setTimeout(() => {
      this.initializeWebview();
    }, 500);
  }
  
  // Método separado para inicializar o webview
  initializeWebview() {
    console.log('Inicializando webview...');
    
    if (this.webviewRef) {
      try {
        const webview = this.webviewRef.nativeElement;
        console.log('Elemento webview obtido:', webview);
        
        // Adiciona listeners para eventos do webview
        webview.addEventListener('did-start-loading', () => {
          console.log('Webview começou a carregar');
          this.isLoading = true;
        });
        
        webview.addEventListener('did-stop-loading', () => {
          console.log('Webview terminou de carregar');
          this.isLoading = false;
          try {
            this.url = webview.getURL();
            this.canGoBack = webview.canGoBack();
            this.canGoForward = webview.canGoForward();
          } catch (e) {
            console.error('Erro ao obter estado do webview:', e);
          }
        });
        
        webview.addEventListener('did-navigate', (event: any) => {
          console.log('Webview navegou para:', event.url);
          this.url = event.url;
        });
        
        webview.addEventListener('dom-ready', () => {
          console.log('DOM do webview está pronto');
        });
        
        // Carrega o Google inicialmente
        console.log('Tentando carregar URL inicial:', this.url);
        try {
          webview.src = this.url;
          // Tenta usar loadURL se disponível
          if (typeof webview.loadURL === 'function') {
            webview.loadURL(this.url);
          }
        } catch (e) {
          console.error('Erro ao carregar URL inicial:', e);
        }
      } catch (e) {
        console.error('Erro ao inicializar webview:', e);
      }
    } else {
      console.error('webviewRef não está disponível');
    }
  }

  // Navega para a URL especificada
  navigate() {
    if (this.isElectron && this.webviewRef) {
      const webview = this.webviewRef.nativeElement;
      
      // Adiciona https:// se não estiver presente
      if (!this.url.startsWith('http://') && !this.url.startsWith('https://')) {
        this.url = 'https://' + this.url;
      }
      
      webview.loadURL(this.url);
    }
  }

  // Recarrega a página atual
  reload() {
    if (this.isElectron && this.webviewRef) {
      const webview = this.webviewRef.nativeElement;
      webview.reload();
    }
  }

  // Navega para trás no histórico
  goBack() {
    if (this.isElectron && this.webviewRef && this.canGoBack) {
      const webview = this.webviewRef.nativeElement;
      webview.goBack();
    }
  }

  // Navega para frente no histórico
  goForward() {
    if (this.isElectron && this.webviewRef && this.canGoForward) {
      const webview = this.webviewRef.nativeElement;
      webview.goForward();
    }
  }

  // Inicia a automação Python
  startAutomation() {
    if (this.isElectron && this.webviewRef) {
      this.isAutomationRunning = true;
      this.isPaused = false;
      
      // Aqui vamos chamar o script Python através do IPC
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('start-automation', {
        url: this.url,
        webviewId: this.webviewRef.nativeElement.id
      });
      
      console.log('Automação iniciada na URL:', this.url);
    }
  }

  // Para a automação Python
  stopAutomation() {
    if (this.isElectron) {
      this.isAutomationRunning = false;
      this.isPaused = false;
      
      // Aqui vamos enviar o comando para parar o script Python
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('stop-automation');
      
      console.log('Automação parada');
    }
  }

  // Pausa/Continua a automação Python
  togglePauseAutomation() {
    if (this.isElectron && this.isAutomationRunning) {
      this.isPaused = !this.isPaused;
      
      // Aqui vamos enviar o comando para pausar/continuar o script Python
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.send('toggle-pause-automation', { paused: this.isPaused });
      
      console.log(this.isPaused ? 'Automação pausada' : 'Automação continuada');
    }
  }
}