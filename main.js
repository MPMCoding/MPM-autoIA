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
  console.log('[main.js] createWindow() chamado.');
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

  // Adiciona argumentos para habilitar depuração remota
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  
  // Carrega o app Angular
  const angularAppUrl = url.format({
    pathname: path.join(__dirname, 'dist/mpm-autoia-desktop/index.html'),
    protocol: 'file:',
    slashes: true
  });
  console.log(`[main.js] Carregando Angular App de: ${angularAppUrl}`);
  mainWindow.loadURL(angularAppUrl);

  // Abre o DevTools para depuração quando necessário
  // mainWindow.webContents.openDevTools();

  // Evento disparado quando a janela é fechada.
  mainWindow.on('closed', function () {
    console.log('[main.js] Evento mainWindow closed.');
    // Dereference the window object
    mainWindow = null;
    if (automationProcess) {
      console.log('[main.js] Encerrando processo de automação.');
      automationProcess.kill();
      automationProcess = null;
    }
    // Garante que o BrowserView seja destruído se a janela principal for fechada
    if (browserView) {
      console.log('[main.js] Destruindo BrowserView no fechamento da janela principal.');
      // Não é necessário remover explicitamente, pois a janela pai está sendo fechada
      // mainWindow.removeBrowserView(browserView); 
      browserView = null;
      browserViewReady = false;
    }
  });

  // Inicializa o banco de dados
  try {
    const sqlite3 = require('better-sqlite3');
    const db = new sqlite3('database.db');
    console.log('[main.js] Banco de dados inicializado com sucesso');
    
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
    console.error('[main.js] Erro ao inicializar o banco de dados:', err.message);
    console.log('[main.js] Continuando sem banco de dados...');
  }
}

// Função para criar o BrowserView
function createBrowserView(initialUrl) {
  console.log(`[main.js] createBrowserView() chamado com URL: ${initialUrl}`);
  if (browserView) {
    console.warn('[main.js] Tentativa de criar BrowserView, mas ele já existe.');
    return browserView; // Retorna a instância existente
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('[main.js] Tentativa de criar BrowserView, mas mainWindow não existe ou foi destruída.');
    return null;
  }

  // Cria o BrowserView com configurações adequadas
  console.log('[main.js] Criando nova instância de BrowserView.');
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Desabilita restrições de segurança para permitir carregamento de qualquer site
      allowRunningInsecureContent: true, // Permite conteúdo misto (HTTP em HTTPS)
      images: true,
      javascript: true,
      plugins: true,
      nativeWindowOpen: false, // Impede abertura de novas janelas nativas
      // Configurações adicionais para depuração remota
      devTools: true
    }
  });

  // Habilita explicitamente a depuração remota para este BrowserView
  browserView.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true); // Permite todas as permissões
  });

  // Adiciona o BrowserView à janela principal
  console.log('[main.js] Adicionando BrowserView à mainWindow.');
  mainWindow.setBrowserView(browserView);
  
  // Define um tamanho e posição inicial para o BrowserView
  // Isso garante que ele seja visível mesmo antes de receber as coordenadas do renderer
  const contentBounds = mainWindow.getContentBounds();
  const initialBounds = {
    x: 300, 
    y: 100, 
    width: contentBounds.width - 350, 
    height: contentBounds.height - 150 
  };
  console.log(`[main.js] Definindo bounds iniciais do BrowserView: ${JSON.stringify(initialBounds)}`);
  browserView.setBounds(initialBounds);
  
  // Habilita o modo de depuração remota para permitir conexão do WebDriver
  console.log('[main.js] Habilitando depuração remota para o BrowserView');
  
  // Abre DevTools para garantir que a depuração remota esteja ativa
  browserView.webContents.openDevTools({ mode: 'detach' });
  setTimeout(() => {
    if (browserView && browserView.webContents) {
      browserView.webContents.closeDevTools();
    }
  }, 1000);
  
  // Salva a porta de depuração em um arquivo para que o script de automação possa encontrá-la
  console.log('[main.js] Salvando porta de depuração (9222) no arquivo debug_port.txt');
  fs.writeFileSync(path.join(__dirname, 'debug_port.txt'), '9222');
  
  // Carrega a URL inicial
  console.log(`[main.js] Carregando URL no BrowserView: ${initialUrl}`);
  browserView.webContents.loadURL(initialUrl);
  currentUrl = initialUrl;
  
  // Configura eventos do BrowserView
  browserView.webContents.on('did-finish-load', () => {
    const loadedUrl = browserView.webContents.getURL();
    console.log(`[main.js] BrowserView did-finish-load: ${loadedUrl}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-page-loaded', loadedUrl);
    }
  });
  
  // Intercepta tentativas de abrir novas janelas e redireciona para a mesma janela
  browserView.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[main.js] Interceptando tentativa de abrir nova janela para URL: ${url}`);
    // Carrega a URL na janela atual em vez de abrir uma nova
    browserView.webContents.loadURL(url);
    return { action: 'deny' }; // Impede a abertura da nova janela
  });
  
  // Intercepta erros de navegação
  browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[main.js] BrowserView did-fail-load: URL=${validatedURL}, Code=${errorCode}, Desc=${errorDescription}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-error', {
        url: validatedURL,
        errorCode: errorCode,
        errorDescription: errorDescription
      });
    }
  });
  
  // Intercepta mudanças de URL para atualizar a barra de endereço
  browserView.webContents.on('did-navigate', (event, navigatedUrl) => {
    console.log(`[main.js] BrowserView did-navigate: ${navigatedUrl}`);
    currentUrl = navigatedUrl;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('current-url', navigatedUrl);
    }
  });
  
  // Habilita o DevTools para o BrowserView quando necessário
  // console.log('[main.js] Abrindo DevTools para BrowserView.');
  // browserView.webContents.openDevTools();
  
  console.log('[main.js] createBrowserView() concluído.');
  return browserView;
}

// Função para posicionar o BrowserView de acordo com as coordenadas do contêiner no renderer
function positionBrowserView(bounds) {
  console.log(`[main.js] positionBrowserView() chamado com bounds: ${JSON.stringify(bounds)}`);
  if (!browserView) {
    console.warn('[main.js] positionBrowserView chamado, mas BrowserView não existe.');
    return;
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.warn('[main.js] positionBrowserView chamado, mas mainWindow não existe ou foi destruída.');
    return;
  }
  
  // Obtém as dimensões da janela principal
  const contentBounds = mainWindow.getContentBounds();
  
  // **IMPORTANTE: Usar as coordenadas recebidas do componente Angular**
  // A lógica anterior com coordenadas fixas foi removida.
  // É crucial que o componente Angular envie as coordenadas corretas do seu contêiner.
  const adjustedBounds = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };

  // Validação básica das coordenadas recebidas
  if (adjustedBounds.width <= 0 || adjustedBounds.height <= 0) {
      console.warn(`[main.js] Coordenadas inválidas recebidas para posicionar BrowserView: ${JSON.stringify(adjustedBounds)}. Usando tamanho padrão.`);
      adjustedBounds.width = Math.max(100, contentBounds.width - adjustedBounds.x - 50); // Garante largura mínima
      adjustedBounds.height = Math.max(100, contentBounds.height - adjustedBounds.y - 50); // Garante altura mínima
  }
  
  // Aplica as coordenadas ajustadas
  console.log(`[main.js] Aplicando bounds ao BrowserView: ${JSON.stringify(adjustedBounds)}`);
  browserView.setBounds(adjustedBounds);
  browserView.setAutoResize({ width: true, height: true }); // Tenta ajustar automaticamente com a janela
  
  browserViewReady = true;
  console.log('[main.js] positionBrowserView() concluído.');
}

// --- Manipuladores IPC --- 

// Manipuladores para a automação Python (sem logs adicionados aqui)
ipcMain.on('start-automation', (event, args) => {
  if (automationProcess) {
    event.reply('automation-status', { status: 'already-running' });
    return;
  }
  
  // Obtém a URL atual do navegador embutido
  let urlToAutomate = currentUrl;
  if (browserView) {
    urlToAutomate = browserView.webContents.getURL();
  }
  
  // Força a abertura do DevTools para garantir que a depuração remota esteja ativa
  if (browserView && browserView.webContents) {
    browserView.webContents.openDevTools({ mode: 'detach' });
    setTimeout(() => {
      if (browserView && browserView.webContents) {
        browserView.webContents.closeDevTools();
      }
    }, 1000);
  }
  
  // Usa o script de automação força bruta que tenta múltiplas abordagens
  let pythonCommand = 'python';
  if (process.platform !== 'win32') {
    pythonCommand = 'python3';
  }
  
  console.log(`[main.js] Iniciando automação força bruta para URL: ${urlToAutomate}`);
  automationProcess = spawn(pythonCommand, [
    'brute_force_automation.py', 
    '--url', urlToAutomate
  ]);
  
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
  console.log(`[main.js] Recebido IPC 'navigate-to-url': ${url}`);
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
    console.log(`[main.js] URL ajustada para: ${url}`);
  }
  currentUrl = url;
  if (browserView) {
    console.log('[main.js] Carregando URL no BrowserView existente.');
    browserView.webContents.loadURL(url);
  } else {
    console.warn('[main.js] Navegação solicitada, mas BrowserView não existe. URL será usada na próxima criação.');
    // Não criamos aqui, esperamos o initialize-browser-view
  }
});

ipcMain.on('browser-back', (event) => {
  console.log("[main.js] Recebido IPC 'browser-back'");
  if (browserView && browserView.webContents.canGoBack()) {
    console.log('[main.js] Navegando para trás.');
    browserView.webContents.goBack();
  } else {
    console.log('[main.js] Não é possível navegar para trás.');
  }
});

ipcMain.on('browser-forward', (event) => {
  console.log("[main.js] Recebido IPC 'browser-forward'");
  if (browserView && browserView.webContents.canGoForward()) {
    console.log('[main.js] Navegando para frente.');
    browserView.webContents.goForward();
  } else {
    console.log('[main.js] Não é possível navegar para frente.');
  }
});

ipcMain.on('browser-reload', (event) => {
  console.log("[main.js] Recebido IPC 'browser-reload'");
  if (browserView) {
    console.log('[main.js] Recarregando página.');
    browserView.webContents.reload();
  } else {
    console.log('[main.js] Recarga solicitada, mas BrowserView não existe.');
  }
});

ipcMain.on('get-current-url', (event) => {
  console.log("[main.js] Recebido IPC 'get-current-url'");
  if (browserView) {
    const urlToSend = browserView.webContents.getURL();
    console.log(`[main.js] Enviando URL atual: ${urlToSend}`);
    event.reply('current-url', urlToSend);
  } else {
    console.log(`[main.js] BrowserView não existe, enviando URL padrão: ${currentUrl}`);
    event.reply('current-url', currentUrl);
  }
});

// Manipulador para posicionar o BrowserView
ipcMain.on('set-browser-view-bounds', (event, bounds) => {
  console.log(`[main.js] Recebido IPC 'set-browser-view-bounds': ${JSON.stringify(bounds)}`);
  positionBrowserView(bounds);
});

// Manipulador para inicializar o BrowserView quando o componente Angular estiver pronto
ipcMain.on('initialize-browser-view', (event) => {
  console.log("[main.js] Recebido IPC 'initialize-browser-view'");
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.error('[main.js] Tentativa de inicializar BrowserView, mas mainWindow não existe ou foi destruída.');
    return;
  }
  if (!browserView) {
    console.log('[main.js] BrowserView não existe, criando agora...');
    createBrowserView(currentUrl); // Cria com a última URL conhecida ou padrão
    if (browserView) {
      console.log('[main.js] BrowserView criado com sucesso. Enviando confirmação.');
      event.reply('browser-view-created');
    } else {
      console.error('[main.js] Falha ao criar BrowserView dentro do handler initialize-browser-view.');
    }
  } else {
    console.log('[main.js] BrowserView já existe. Apenas enviando confirmação.');
    // Garante que esteja visível se já existir (pode ter sido removido e recriado)
    mainWindow.setBrowserView(browserView);
    event.reply('browser-view-created');
  }
});

// Manipulador para destruir/remover o BrowserView
ipcMain.on("destroy-browser-view", (event) => {
  console.log("[main.js] Recebido IPC 'destroy-browser-view'");
  if (browserView && mainWindow && !mainWindow.isDestroyed()) {
    console.log("[main.js] Removendo BrowserView da janela principal.");
    mainWindow.removeBrowserView(browserView);
    // Destruir o BrowserView pode causar problemas se for recriado rapidamente.
    // Apenas remover da janela é geralmente suficiente e mais seguro.
    // console.log("[main.js] Destruindo webContents do BrowserView.");
    // browserView.webContents.destroy(); // Opcional: descomente se a destruição for necessária
    browserView = null;
    browserViewReady = false;
    console.log("[main.js] BrowserView removido e variável zerada.");
  } else {
    console.log("[main.js] Tentativa de destruir BrowserView, mas ele não existe ou a janela foi destruída.");
  }
});

// Manipulador para mostrar o DevTools do BrowserView
ipcMain.on('toggle-devtools', (event) => {
  console.log("[main.js] Recebido IPC 'toggle-devtools'");
  if (browserView) {
    if (browserView.webContents.isDevToolsOpened()) {
      console.log('[main.js] Fechando DevTools do BrowserView.');
      browserView.webContents.closeDevTools();
    } else {
      console.log('[main.js] Abrindo DevTools do BrowserView.');
      browserView.webContents.openDevTools();
    }
  } else {
    console.log('[main.js] Solicitação para DevTools, mas BrowserView não existe.');
  }
});

// Manipuladores de banco de dados (sem logs adicionados aqui)
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

// --- Eventos do App --- 

// Evento para redimensionamento da janela
app.on("browser-window-resize", () => {
  // Este evento pode ser chamado frequentemente, evite logs excessivos aqui
  if (browserView && mainWindow && !mainWindow.isDestroyed()) {
    // A lógica de reposicionamento pode precisar ser mais inteligente,
    // talvez buscando as coordenadas atuais do contêiner Angular via IPC novamente.
    // Por enquanto, mantendo a lógica de usar as coordenadas recebidas anteriormente
    // ou um fallback fixo se as coordenadas não foram recebidas/são inválidas.
    // A chamada setAutoResize pode ajudar em alguns casos.
    // console.log('[main.js] Janela redimensionada, ajustando BrowserView (se necessário).');
    // positionBrowserView(currentBounds); // Precisaria armazenar 'currentBounds'
  }
});

// Inicializa o aplicativo quando estiver pronto
app.on("ready", () => {
  console.log('[main.js] Evento app ready.');
  createWindow();
  // REMOVIDO: A criação do BrowserView agora é feita sob demanda via IPC
  console.log('[main.js] Criação do BrowserView adiada para recebimento de IPC.');
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  console.log('[main.js] Evento app window-all-closed.');
  // No macOS é comum para aplicativos e sua barra de menu 
  // permanecerem ativos até que o usuário explicitamente encerre com Cmd + Q
  if (process.platform !== 'darwin') {
    console.log('[main.js] Encerrando aplicação.');
    app.quit();
  }
});

app.on('activate', function () {
  console.log('[main.js] Evento app activate.');
  // No macOS é comum recriar uma janela no aplicativo quando o
  // ícone do dock é clicado e não há outras janelas abertas.
  if (mainWindow === null) {
    console.log('[main.js] Recriando janela principal.');
    createWindow();
  }
});

