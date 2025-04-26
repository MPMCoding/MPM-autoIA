const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const sqlite3 = require('better-sqlite3');

// Porta para a automação
const AUTOMATION_PORT = 3000; // Ajuste para a porta correta da sua automação

// Mantenha uma referência global do objeto window, se não fizer isso, a janela
// será fechada automaticamente quando o objeto JavaScript for coletado pelo garbage collector.
let mainWindow;

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
  try {
    const db = new sqlite3('mpm-autoia.db');
    const activities = db.prepare('SELECT * FROM atividades').all();
    return activities;
  } catch (err) {
    console.error('Erro ao buscar atividades:', err);
    return [];
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