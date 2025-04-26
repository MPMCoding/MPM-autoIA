const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const fs = require('fs');

// Tentativa de importar better-sqlite3 com tratamento de erro
let sqlite3 = null;
try {
  sqlite3 = require('better-sqlite3');
} catch (err) {
  console.warn('Aviso: Não foi possível carregar o módulo better-sqlite3:', err.message);
  console.warn('O banco de dados SQLite não estará disponível, mas o navegador embutido ainda funcionará.');
}

// Porta para a automação
const AUTOMATION_PORT = 3000; // Ajuste para a porta correta da sua automação

// Mantenha uma referência global do objeto window, se não fizer isso, a janela
// será fechada automaticamente quando o objeto JavaScript for coletado pelo garbage collector.
let mainWindow;

// Referência para o processo de automação Python
let automationProcess = null;
let automationPaused = false;

function createWindow() {
  // Cria a janela do navegador.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true, // Habilita a tag webview
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

  // Em desenvolvimento, abra o DevTools.
  // mainWindow.webContents.openDevTools();

  // Emitido quando a janela é fechada.
  mainWindow.on('closed', function() {
    // Dereferencia o objeto window, geralmente você armazenaria windows
    // em um array se seu app suporta múltiplas janelas, este é o momento
    // em que você deve excluir o elemento correspondente.
    mainWindow = null;
  });

  // Configuração do banco de dados SQLite
  setupDatabase();
}

// Inicializa o banco de dados SQLite
function setupDatabase() {
  // Se o módulo SQLite não foi carregado, não tenta configurar o banco de dados
  if (!sqlite3) {
    console.warn('Pulando configuração do banco de dados: módulo better-sqlite3 não disponível');
    return;
  }
  
  try {
    const db = new sqlite3('mpm-autoia.db');
    
    // Cria tabelas se não existirem
    db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS atividades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descricao TEXT,
        modulo TEXT,
        disciplina TEXT,
        status TEXT,
        nota REAL,
        prazo TEXT,
        usuario_id INTEGER,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      );
    `);
    
    // Insere dados de exemplo se a tabela estiver vazia
    const count = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
    
    if (count.count === 0) {
      // Insere um usuário de exemplo
      const insertUser = db.prepare('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)');
      insertUser.run('Estudante Exemplo', 'estudante@exemplo.com', 'senha123');
      
      // Insere atividades de exemplo
      const userId = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('estudante@exemplo.com').id;
      const insertActivity = db.prepare(
        'INSERT INTO atividades (titulo, descricao, modulo, disciplina, status, nota, prazo, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      
      insertActivity.run('Fundamentos de Python', 'Módulo 2: Estruturas de Controle', 'Módulo 2', 'Python', 'Concluído', 9.5, '2023-05-15', userId);
      insertActivity.run('Banco de Dados SQL', 'Módulo 1: Introdução a Bancos Relacionais', 'Módulo 1', 'SQL', 'Pendente', null, '2023-05-25', userId);
      insertActivity.run('Algoritmos e Estruturas de Dados', 'Módulo 3: Complexidade de Algoritmos', 'Módulo 3', 'Algoritmos', 'Concluído', 8.0, '2023-05-10', userId);
    }
    
    console.log('Banco de dados inicializado com sucesso');
  } catch (err) {
    console.error('Erro ao configurar o banco de dados:', err);
  }
}

// Configuração de IPC para comunicação entre processos
ipcMain.on('get-automation-port', (event) => {
  event.returnValue = AUTOMATION_PORT;
});

// Manipuladores de banco de dados
ipcMain.handle('get-activities', async () => {
  // Se o módulo SQLite não foi carregado, retorna dados mockados
  if (!sqlite3) {
    console.warn('Módulo better-sqlite3 não disponível, retornando dados mockados');
    return getMockActivities();
  }
  
  try {
    const db = new sqlite3('mpm-autoia.db');
    const activities = db.prepare('SELECT * FROM atividades').all();
    return activities;
  } catch (err) {
    console.error('Erro ao buscar atividades:', err);
    return getMockActivities();
  }
});

// Função para retornar dados mockados quando o banco de dados não está disponível
function getMockActivities() {
  return [
    {
      id: 1,
      titulo: 'Fundamentos de Python',
      descricao: 'Módulo 2: Estruturas de Controle',
      modulo: 'Módulo 2',
      disciplina: 'Python',
      status: 'Concluído',
      nota: 9.5,
      prazo: '2023-05-15'
    },
    {
      id: 2,
      titulo: 'Banco de Dados SQL',
      descricao: 'Módulo 1: Introdução a Bancos Relacionais',
      modulo: 'Módulo 1',
      disciplina: 'SQL',
      status: 'Pendente',
      nota: null,
      prazo: '2023-05-25'
    },
    {
      id: 3,
      titulo: 'Algoritmos e Estruturas de Dados',
      descricao: 'Módulo 3: Complexidade de Algoritmos',
      modulo: 'Módulo 3',
      disciplina: 'Algoritmos',
      status: 'Concluído',
      nota: 8.0,
      prazo: '2023-05-10'
    }
  ];
}

// Manipuladores para a automação Python
ipcMain.on('start-automation', (event, args) => {
  try {
    if (automationProcess) {
      console.log('Automação já está em execução');
      return;
    }

    const currentUrl = args.url;
    console.log('Iniciando automação na URL:', currentUrl);
    
    // Verifica se o Python está instalado
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    
    // Cria um arquivo temporário com a URL atual
    fs.writeFileSync('current_url.txt', currentUrl);
    
    // Inicia o processo Python
    automationProcess = spawn(pythonCommand, ['mpm_autoia_interface_embedded.py', '--embedded', '--url', currentUrl]);
    
    automationProcess.stdout.on('data', (data) => {
      console.log(`Automação (stdout): ${data}`);
      mainWindow.webContents.send('automation-log', data.toString());
    });
    
    automationProcess.stderr.on('data', (data) => {
      console.error(`Automação (stderr): ${data}`);
      mainWindow.webContents.send('automation-error', data.toString());
    });
    
    automationProcess.on('close', (code) => {
      console.log(`Processo de automação encerrado com código ${code}`);
      automationProcess = null;
      automationPaused = false;
      mainWindow.webContents.send('automation-stopped');
    });
    
    mainWindow.webContents.send('automation-started');
    
  } catch (error) {
    console.error('Erro ao iniciar automação:', error);
    mainWindow.webContents.send('automation-error', error.toString());
  }
});

ipcMain.on('stop-automation', () => {
  if (automationProcess) {
    console.log('Parando automação');
    automationProcess.kill();
    automationProcess = null;
    automationPaused = false;
    mainWindow.webContents.send('automation-stopped');
  }
});

ipcMain.on('toggle-pause-automation', (event, args) => {
  if (automationProcess) {
    automationPaused = args.paused;
    console.log(automationPaused ? 'Pausando automação' : 'Continuando automação');
    
    // Envia sinal para o processo Python
    automationProcess.stdin.write(automationPaused ? 'pause\n' : 'continue\n');
    
    mainWindow.webContents.send('automation-paused', automationPaused);
  }
});

// Este método será chamado quando o Electron tiver finalizado
// a inicialização e está pronto para criar janelas do navegador.
app.on('ready', createWindow);

// Sai quando todas as janelas estiverem fechadas.
app.on('window-all-closed', function() {
  // No macOS é comum para aplicativos e sua barra de menu
  // permanecerem ativos até que o usuário explicitamente encerre com Cmd + Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function() {
  // No macOS é comum recriar uma janela no aplicativo quando o
  // ícone da dock é clicado e não existem outras janelas abertas.
  if (mainWindow === null) createWindow();
});