import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { ElectronService } from '../../services/electron.service';

@Component({
  selector: 'app-navegador',
  templateUrl: './navegador.component.html',
  styleUrls: ['./navegador.component.scss']
})
export class NavegadorComponent implements OnInit, AfterViewInit {
  @ViewChild('webview') webviewRef!: ElementRef;
  url: string = '';
  isElectron: boolean = false;
  automationPort: number = 3000;
  isLoading: boolean = false;
  canGoBack: boolean = false;
  canGoForward: boolean = false;

  constructor(private electronService: ElectronService) {
    this.isElectron = this.electronService.isElectron;
    if (this.isElectron) {
      this.automationPort = this.electronService.automationPort;
    }
  }

  ngOnInit() {
    // Define a URL inicial baseada na porta de automação
    this.url = `http://localhost:${this.automationPort}`;
  }

  ngAfterViewInit() {
    if (this.isElectron && this.webviewRef) {
      const webview = this.webviewRef.nativeElement;
      
      // Adiciona listeners para eventos do webview
      webview.addEventListener('did-start-loading', () => {
        this.isLoading = true;
      });
      
      webview.addEventListener('did-stop-loading', () => {
        this.isLoading = false;
        this.url = webview.getURL();
        this.canGoBack = webview.canGoBack();
        this.canGoForward = webview.canGoForward();
      });
      
      webview.addEventListener('did-navigate', (event: any) => {
        this.url = event.url;
      });
    }
  }

  // Navega para a URL especificada
  navigate() {
    if (this.isElectron && this.webviewRef) {
      const webview = this.webviewRef.nativeElement;
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
}