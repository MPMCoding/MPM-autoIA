const { app, BrowserWindow, BrowserView, ipcMain, dialog } = require(\'electron\');
const path = require(\'path\');
const url = require(\'url\');
const { spawn } = require(\'child_process\');
const fs = require(\'fs\');
const os = require(\'os\');

// Variáveis globais
let mainWindow;
let splashWindow; // Janela para a splash screen
let browserView;
let currentUrl = \'https://www.google.com\';
let automationProcess = null;
let automationPaused = false;
let browserViewReady = false;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400, // Tamanho adequado para a splash
    height: 300,
    transparent: true, // Para fundos possivelmente transparentes no HTML
    frame: false, // Sem bordas ou barra de título
    alwaysOnTop: true // Fica sobre outras janelas
  });
  splashWindow.loadFile(path.join(__dirname, \'splash.html\'));
  splashWindow.on(\'closed\", () => {
    splashWindow = null;
  });
}

function createWindow() {
  // Cria a janela principal, mas inicialmente oculta
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Inicia oculta
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      webSecurity: false,
      preload: path.join(__dirname, \'preload.js\')
    },
    // Use o logo como ícone da janela também (requer conversão para .ico/.icns)
    // icon: path.join(__dirname, \'logo.png\') // Idealmente, use .ico para Windows
    icon: path.join(__dirname, \'src/assets/icons/icon.png\') // Mantendo o ícone anterior por enquanto
  });

  // Carrega o app Angular
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, \'dist/mpm-autoia-desktop/index.html\'),
      protocol: \'file:\',
      slashes: true
    })
  );

  // Evento disparado quando a janela principal está pronta para ser exibida
  mainWindow.once(\'ready-to-show\", () => {
    if (splashWindow) {
      splashWindow.close(); // Fecha a splash screen
    }
    mainWindow.show(); // Mostra a janela principal
    // mainWindow.webContents.openDevTools(); // Abre DevTools se necessário para depuração
  });

  // Evento disparado quando a janela é fechada.
  mainWindow.on(\'closed\", function () {
    mainWindow = null;
    if (automationProcess) {
      automationProcess.kill();
      automationProcess = null;
    }
    // Garante que o app feche se a janela principal for fechada
    if (process.platform !== \'darwin\') {
      app.quit();
    }
  });

  // Inicializa o banco de dados (sem alterações aqui)
  try {
    const sqlite3 = require(\'better-sqlite3\');
    const db = new sqlite3(\'database.db\');
    console.log(\'Banco de dados inicializado com sucesso\');
    db.exec(`
      CREATE TABLE IF NOT EXISTS configuracoes (
        id INTEGER PRIMARY KEY,
        nome TEXT,
        valor TEXT
      );
    `);
    db.close();
  } catch (err) {
    console.error(\'Erro ao inicializar o banco de dados:\', err.message);
    console.log(\'Continuando sem banco de dados...\');
  }
}

// Função para criar o BrowserView (sem alterações significativas aqui)
function createBrowserView(initialUrl) {
  if (!mainWindow || mainWindow.isDestroyed()) return; // Verifica se mainWindow existe

  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      images: true,
      javascript: true,
      plugins: true
    }
  });

  mainWindow.setBrowserView(browserView);
  
  const contentBounds = mainWindow.getContentBounds();
  // Posição inicial pode ser ajustada ou removida se positionBrowserView for chamado imediatamente
  browserView.setBounds({ 
    x: 0, // Começa no canto para evitar flash inicial estranho
    y: 0, 
    width: 1, 
    height: 1 
  });
  
  browserView.webContents.loadURL(initialUrl);
  currentUrl = initialUrl;
  
  browserView.webContents.on(\'did-finish-load\", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(\'browser-page-loaded\", browserView.webContents.getURL());
    }
  });
  
  browserView.webContents.on(\'did-fail-load\", (event, errorCode, errorDescription, validatedURL) => {
    console.log(`Erro ao carregar URL: ${validatedURL}, Código: ${errorCode}, Descrição: ${errorDescription}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(\'browser-error\", {
        url: validatedURL,
        errorCode: errorCode,
        errorDescription: errorDescription
      });
    }
  });
  
  browserView.webContents.on(\'did-navigate\", (event, url) => {
    currentUrl = url;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(\'current-url\", url);
    }
  });
  
  // browserView.webContents.openDevTools();
  
  return browserView;
}

// Função para posicionar o BrowserView (sem alterações aqui)
function positionBrowserView(bounds) {
  if (!browserView || !mainWindow || mainWindow.isDestroyed()) return;
  
  const adjustedBounds = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height)
  };
  
  browserView.setBounds(adjustedBounds);
  browserViewReady = true;
  console.log(`BrowserView posicionado com coordenadas recebidas: x=${adjustedBounds.x}, y=${adjustedBounds.y}, width=${adjustedBounds.width}, height=${adjustedBounds.height}`);
}

// Manipuladores IPC (sem alterações significativas aqui, exceto destroy-browser-view)

ipcMain.on(\'start-automation\", (event, args) => {
  if (automationProcess) {
    event.reply(\'automation-status\", { status: \'already-running\' });
    return;
  }
  let pythonCommand = process.platform === \'win32\' ? \'python\' : \'python3\';
  automationProcess = spawn(pythonCommand, [\'mpm_autoia_interface_embedded.py\", \'--embedded\", \'--url\", currentUrl]);

  automationProcess.stdout.on(\'data\", (data) => {
    console.log(`Automação stdout: ${data}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
       event.reply(\'automation-output\", { type: \'stdout\", data: data.toString() });
    }
  });
  automationProcess.stderr.on(\'data\", (data) => {
    console.error(`Automação stderr: ${data}`);
     if (mainWindow && !mainWindow.isDestroyed()) {
        event.reply(\'automation-output\", { type: \'stderr\", data: data.toString() });
     }
  });
  automationProcess.on(\'close\", (code) => {
    console.log(`Processo de automação encerrado com código ${code}`);
    automationProcess = null;
     if (mainWindow && !mainWindow.isDestroyed()) {
        event.reply(\'automation-status\", { status: \'stopped\", code: code });
     }
  });
  event.reply(\'automation-status\", { status: \'started\' });
});

ipcMain.on(\'stop-automation\", (event) => {
  if (automationProcess) {
    automationProcess.kill();
    automationProcess = null;
    event.reply(\'automation-status\", { status: \'stopped\' });
  } else {
    event.reply(\'automation-status\", { status: \'not-running\' });
  }
});

ipcMain.on(\'pause-automation\", (event) => {
  if (automationProcess) {
    if (!automationPaused) {
      automationProcess.stdin.write(\'pause\\n\');
      automationPaused = true;
      event.reply(\'automation-status\", { status: \'paused\' });
    } else {
      automationProcess.stdin.write(\'resume\\n\');
      automationPaused = false;
      event.reply(\'automation-status\", { status: \'resumed\' });
    }
  } else {
    event.reply(\'automation-status\", { status: \'not-running\' });
  }
});

ipcMain.on(\'navigate-to-url\", (event, url) => {
  if (!url.startsWith(\'http://\') && !url.startsWith(\'https://\')) {
    url = \'https://\' + url;
  }
  currentUrl = url;
  if (browserView) {
    browserView.webContents.loadURL(url);
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    browserView = createBrowserView(url);
    // Se criar aqui, talvez precise posicionar imediatamente
    // positionBrowserView(...); // Precisa das coordenadas do componente Angular
  }
});

ipcMain.on(\'browser-back\", (event) => {
  if (browserView && browserView.webContents.canGoBack()) {
    browserView.webContents.goBack();
  }
});

ipcMain.on(\'browser-forward\", (event) => {
  if (browserView && browserView.webContents.canGoForward()) {
    browserView.webContents.goForward();
  }
});

ipcMain.on(\'browser-reload\", (event) => {
  if (browserView) {
    browserView.webContents.reload();
  }
});

ipcMain.on(\'get-current-url\", (event) => {
  if (browserView) {
    event.reply(\'current-url\", browserView.webContents.getURL());
  } else {
    event.reply(\'current-url\", currentUrl);
  }
});

ipcMain.on(\'set-browser-view-bounds\", (event, bounds) => {
  positionBrowserView(bounds);
});

ipcMain.on(\'initialize-browser-view\", (event) => {
  if (!browserView && mainWindow && !mainWindow.isDestroyed()) {
    console.log(\'Recebido initialize-browser-view. Criando BrowserView...\');
    browserView = createBrowserView(currentUrl);
    // Envia confirmação APÓS criar e adicionar à janela
    if (browserView) {
       event.reply(\'browser-view-created\');
    } else {
       console.error(\'Falha ao criar BrowserView em initialize-browser-view\');
    }
  } else if (browserView) {
    console.log(\'Recebido initialize-browser-view, mas BrowserView já existe. Enviando confirmação.\');
    // Se já existe (talvez de uma navegação anterior), apenas confirma
    event.reply(\'browser-view-created\');
  } else {
     console.error(\'Recebido initialize-browser-view, mas mainWindow não está pronta.\');
  }
});

ipcMain.on(\'toggle-devtools\", (event) => {
  if (browserView) {
    if (browserView.webContents.isDevToolsOpened()) {
      browserView.webContents.closeDevTools();
    } else {
      browserView.webContents.openDevTools();
    }
  }
});

ipcMain.on(\'db-query\", (event, query, params) => {
  try {
    const sqlite3 = require(\'better-sqlite3\');
    const db = new sqlite3(\'database.db\');
    let result;
    if (query.trim().toLowerCase().startsWith(\'select\')) {
      result = db.prepare(query).all(params);
    } else {
      result = db.prepare(query).run(params);
    }
    db.close();
    event.reply(\'db-result\", { success: true, data: result });
  } catch (err) {
    console.error(\'Erro na consulta SQL:\', err.message);
    event.reply(\'db-result\", { success: false, error: err.message });
  }
});

// Manipulador para destruir/remover o BrowserView
ipcMain.on(\
