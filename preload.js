// Preload script para o Electron
const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras do Node.js para a janela do navegador
contextBridge.exposeInMainWorld('electron', {
  // Funções para comunicação com o processo principal
  getAutomationPort: () => ipcRenderer.sendSync('get-automation-port'),
  getActivities: () => ipcRenderer.invoke('get-activities'),
  
  // Funções de utilidade
  platform: process.platform,
  
  // Funções para o webview
  isElectron: true,
  loadURL: (url) => ipcRenderer.invoke('load-url', url)
});

// Adiciona variáveis globais para o webview
window.addEventListener('DOMContentLoaded', () => {
  // Configuração para o webview
  const webviews = document.querySelectorAll('webview');
  webviews.forEach(webview => {
    // Injeta CSS personalizado no webview
    webview.addEventListener('dom-ready', () => {
      webview.insertCSS(`
        /* Estilos personalizados para o conteúdo do webview */
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
      `);
    });

    // Manipula eventos de navegação
    webview.addEventListener('will-navigate', (event) => {
      console.log('Navegando para:', event.url);
    });
  });
});