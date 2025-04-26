import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ElectronService } from './services/electron.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'MPM AutoIA - Assistente de Aprendizagem';

  constructor(
    public router: Router,
    private electronService: ElectronService
  ) {}

  ngOnInit() {
    // Verifica se estamos rodando no Electron
    if (this.electronService.isElectron) {
      console.log('Executando no Electron');
    } else {
      console.log('Executando no navegador');
    }
  }
}