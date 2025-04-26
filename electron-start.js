/**
 * Script de inicialização para o Electron
 * Este arquivo facilita a execução da aplicação Electron com Angular
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m'
};

// Função para imprimir mensagens formatadas
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let color = colors.reset;
  
  switch(type) {
    case 'success':
      color = colors.green;
      break;
    case 'error':
      color = colors.red;
      break;
    case 'warning':
      color = colors.yellow;
      break;
    case 'info':
    default:
      color = colors.bright;
  }
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

// Verifica se o diretório dist existe
const distPath = path.join(__dirname, 'dist', 'mpm-autoia-desktop');
const needsBuild = !fs.existsSync(distPath) || !fs.existsSync(path.join(distPath, 'index.html'));

// Função principal
async function start() {
  try {
    log('Iniciando MPM AutoIA Desktop...', 'info');
    
    // Compila o Angular se necessário
    if (needsBuild) {
      log('Compilando a aplicação Angular...', 'info');
      
      const buildProcess = spawn('ng', ['build', '--base-href', './'], { 
        shell: true,
        stdio: 'inherit'
      });
      
      await new Promise((resolve, reject) => {
        buildProcess.on('close', (code) => {
          if (code === 0) {
            log('Compilação concluída com sucesso!', 'success');
            resolve();
          } else {
            log(`Erro na compilação. Código de saída: ${code}`, 'error');
            reject(new Error(`Falha na compilação com código ${code}`));
          }
        });
      });
    } else {
      log('Usando build existente da aplicação Angular', 'info');
    }
    
    // Inicia o Electron
    log('Iniciando o Electron...', 'info');
    const electronProcess = spawn('electron', ['.'], { 
      shell: true,
      stdio: 'inherit'
    });
    
    electronProcess.on('close', (code) => {
      if (code === 0) {
        log('Aplicação encerrada normalmente.', 'success');
      } else {
        log(`Aplicação encerrada com código: ${code}`, 'warning');
      }
    });
    
  } catch (error) {
    log(`Erro ao iniciar a aplicação: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Inicia a aplicação
start();