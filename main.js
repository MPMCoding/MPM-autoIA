const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// Variáveis globais
let mainWindow;
let browserView;
let currentUrl = 'https://www.google.com';
let automationProcess = null;
let automationPaused = false;
let browserViewReady = false;

function createWindow() {
  // Cria a janela do navegador.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true, // Habilita a tag webview
      webSecurity: false, // Desabilita restrições de segurança para permitir carregamento de qualquer site
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'src/assets/icons/icon.png')
  });

  // Carrega o app Angular
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'dist/mpm-autoia-desktop/index.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  // Abre o DevTools para depuração quando necessário
  // mainWindow.webContents.openDevTools();

  // Evento disparado quando a janela é fechada.
  mainWindow.on('closed', function () {
    // Dereference the window object
    mainWindow = null;
    if (automationProcess) {
      automationProcess.kill();
      automationProcess = null;
    }
  });

  // Inicializa o banco de dados
  try {
    const sqlite3 = require('better-sqlite3');
    const db = new sqlite3('database.db');
    console.log('Banco de dados inicializado com sucesso');
    
    // Cria tabelas se não existirem
    db.exec(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY,
        nome TEXT,
        valor TEXT
      );
    `);
    
    db.close();
  } catch (err) {
    console.error('Erro ao inicializar o banco de dados:', err.message);
    console.log('Continuando sem banco de dados...');
  }
}

// Função para criar o BrowserView
function createBrowserView(initialUrl) {
  // Cria o BrowserView com configurações adequadas
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Desabilita restrições de segurança para permitir carregamento de qualquer site
      allowRunningInsecureContent: true, // Permite conteúdo misto (HTTP em HTTPS)
      images: true,
      javascript: true,
      plugins: true
    }
  });

  // Adiciona o BrowserView à janela principal
  mainWindow.setBrowserView(browserView);
  
  // Define um tamanho e posição inicial para o BrowserView
  // Isso garante que ele seja visível mesmo antes de receber as coordenadas do renderer
  const contentBounds = mainWindow.getContentBounds();
  browserView.setBounds({ 
    x: 300, 
    y: 100, 
    width: contentBounds.width - 350, 
    height: contentBounds.height - 150 
  });
  
  // Carrega a URL inicial
  browserView.webContents.loadURL(initialUrl);
  currentUrl = initialUrl;
  
  // Configura eventos do BrowserView
  browserView.webContents.on('did-finish-load', () => {
    // Notifica o renderer process que a página foi carregada
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-page-loaded', browserView.webContents.getURL());
    }
  });
  
  // Intercepta erros de navegação
  browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.log(`Erro ao carregar URL: ${validatedURL}, Código: ${errorCode}, Descrição: ${errorDescription}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-error', {
        url: validatedURL,
        errorCode: errorCode,
        errorDescription: errorDescription
      });
    }
  });
  
  // Intercepta mudanças de URL para atualizar a barra de endereço
  browserView.webContents.on('did-navigate', (event, url) => {
    currentUrl = url;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('current-url', url);
    }
  });
  
  // Habilita o DevTools para o BrowserView quando necessário
  // browserView.webContents.openDevTools();
  
  return browserView;
}

// Função para posicionar o BrowserView de acordo com as coordenadas do contêiner no renderer
function positionBrowserView(bounds) {
  if (!browserView || !mainWindow || mainWindow.isDestroyed()) return;
  
  // Obtém as dimensões da janela principal
  const contentBounds = mainWindow.getContentBounds();
  
  // Ajusta as coordenadas para considerar a posição da janela e decorações
  // Usa valores fixos para garantir que o BrowserView seja sempre visível
  const adjustedBounds = {
    x: 300, // Posição fixa à direita do menu lateral
    y: 100, // Posição fixa abaixo da barra de navegação
    width: contentBounds.width - 350, // Largura ajustada para considerar o menu lateral
    height: contentBounds.height - 150 // Altura ajustada para considerar barras de navegação
  };
  
  // Aplica as coordenadas ajustadas
  browserView.setBounds(adjustedBounds);
  
  browserViewReady = true;
  console.log(`BrowserView posicionado com coordenadas fixas: x=${adjustedBounds.x}, y=${adjustedBounds.y}, width=${adjustedBounds.width}, height=${adjustedBounds.height}`);
}

// Manipuladores para a automação Python
ipcMain.on('start-automation', (event, args) => {
  if (automationProcess) {
    event.reply('automation-status', { status: 'already-running' });
    return;
  }

  // Determina o comando Python baseado no sistema operacional
  let pythonCommand = 'python';
  if (process.platform !== 'win32') {
    pythonCommand = 'python3';
  }

  // Inicia o processo Python
  automationProcess = spawn(pythonCommand, ['mpm_autoia_interface_embedded.py', '--embedded', '--url', currentUrl]);

  automationProcess.stdout.on('data', (data) => {
    console.log(`Automação stdout: ${data}`);
    event.reply('automation-output', { type: 'stdout', data: data.toString() });
  });

  automationProcess.stderr.on('data', (data) => {
    console.error(`Automação stderr: ${data}`);
    event.reply('automation-output', { type: 'stderr', data: data.toString() });
  });

  automationProcess.on('close', (code) => {
    console.log(`Processo de automação encerrado com código ${code}`);
    automationProcess = null;
    event.reply('automation-status', { status: 'stopped', code: code });
  });

  event.reply('automation-status', { status: 'started' });
});

ipcMain.on('stop-automation', (event) => {
  if (automationProcess) {
    automationProcess.kill();
    automationProcess = null;
    event.reply('automation-status', { status: 'stopped' });
  } else {
    event.reply('automation-status', { status: 'not-running' });
  }
});

ipcMain.on('pause-automation', (event) => {
  if (automationProcess) {
    if (!automationPaused) {
      automationProcess.stdin.write('pause\n');
      automationPaused = true;
      event.reply('automation-status', { status: 'paused' });
    } else {
      automationProcess.stdin.write('resume\n');
      automationPaused = false;
      event.reply('automation-status', { status: 'resumed' });
    }
  } else {
    event.reply('automation-status', { status: 'not-running' });
  }
});

// Manipuladores para o navegador embutido
ipcMain.on('navigate-to-url', (event, url) => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  currentUrl = url;
  
  if (browserView) {
    browserView.webContents.loadURL(url);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    // Se o BrowserView ainda não foi criado, cria-o agora
    browserView = createBrowserView(url);
  }
});

ipcMain.on('browser-back', (event) => {
  if (browserView && browserView.webContents.canGoBack()) {
    browserView.webContents.goBack();
  }
});

ipcMain.on('browser-forward', (event) => {
  if (browserView && browserView.webContents.canGoForward()) {
    browserView.webContents.goForward();
  }
});

ipcMain.on('browser-reload', (event) => {
  if (browserView) {
    browserView.webContents.reload();
  }
});

ipcMain.on('get-current-url', (event) => {
  if (browserView) {
    event.reply('current-url', browserView.webContents.getURL());
  } else {
    event.reply('current-url', currentUrl);
  }
});

// Manipulador para posicionar o BrowserView
ipcMain.on('set-browser-view-bounds', (event, bounds) => {
  positionBrowserView(bounds);
});

// Manipulador para inicializar o BrowserView quando o componente Angular estiver pronto
ipcMain.on('initialize-browser-view', (event) => {
  if (!browserView && mainWindow && !mainWindow.isDestroyed()) {
    browserView = createBrowserView(currentUrl);
    event.reply('browser-view-created');
  } else if (browserView) {
    event.reply('browser-view-created');
  }
});

// Manipulador para mostrar o DevTools do BrowserView
ipcMain.on('toggle-devtools', (event) => {
  if (browserView) {
    if (browserView.webContents.isDevToolsOpened()) {
      browserView.webContents.closeDevTools();
    } else {
      browserView.webContents.openDevTools();
    }
  }
});

// Manipuladores de banco de dados
ipcMain.on('db-query', (event, query, params) => {
  try {
    const sqlite3 = require('better-sqlite3');
    const db = new sqlite3('database.db');
    
    let result;
    if (query.trim().toLowerCase().startsWith('select')) {
      result = db.prepare(query).all(params);
    } else {
      result = db.prepare(query).run(params);
    }
    
    db.close();
    event.reply('db-result', { success: true, data: result });
  } catch (err) {
    console.error('Erro na consulta SQL:', err.message);
    event.reply('db-result', { success: false, error: err.message });
  }
});

//// Evento para redimensionamento da janela
app.on("browser-window-resize", () => {
  if (browserView && mainWindow && !mainWindow.isDestroyed()) {
    const contentBounds = mainWindow.getContentBounds();
    // Recalcula a posição/tamanho com base nas coordenadas fixas/relativas desejadas
    // Exemplo mantendo a lógica anterior de coordenadas fixas:
    browserView.setBounds({ 
      x: 300, 
      y: 100, 
      width: contentBounds.width - 350, 
      height: contentBounds.height - 150 
    });
    // Se precisar usar as coordenadas do componente, precisaria de um IPC para obtê-las novamente
  }
});

// Inicializa o aplicativo quando estiver pronto
app.on("ready", () => {
  createWindow();
  
  // REMOVIDO: A criação do BrowserView agora é feita sob demanda via IPC
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // No macOS é comum para aplicativos e sua barra de menu 
  // permanecerem ativos até que o usuário explicitamente encerre com Cmd + Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  // No macOS é comum recriar uma janela no aplicativo quando o
  // ícone do dock é clicado e não há outras janelas abertas.
  if (mainWindow === null) createWindow();
});


// Manipulador para destruir/remover o BrowserView
ipcMain.on("destroy-browser-view", (event) => {
  if (browserView && mainWindow && !mainWindow.isDestroyed()) {
    console.log("Removendo BrowserView da janela principal.");
    mainWindow.removeBrowserView(browserView);
    // Destruir o BrowserView pode causar problemas se for recriado rapidamente.
    // Apenas remover da janela é geralmente suficiente e mais seguro.
    // browserView.webContents.destroy(); // Opcional: descomente se a destruição for necessária
    browserView = null;
    browserViewReady = false;
    console.log("BrowserView removido.");
  } else {
    console.log("Tentativa de destruir BrowserView, mas ele não existe ou a janela foi destruída.");
  }
});

