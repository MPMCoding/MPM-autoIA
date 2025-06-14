// Módulo de automação para o BrowserView embutido no Electron
const { ipcMain } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Configuração da API do Google Gemini
const GEMINI_API_KEY = "AIzaSyCq2WUCRoMFNC7_qY0uU30lESqvgndCBCU";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Função para fazer requisições à API do Gemini com suporte a texto e imagens
async function callGeminiAPI(prompt, imageParts = []) {
  let requestData = {
    contents: [{
      parts: []
    }],
    generationConfig: {
      temperature: 0.00,  // Reduzido para maior precisão
      topP: 0.1,          // Ajustado para foco
      topK: 1,           // Reduzido para maior consistência
      maxOutputTokens: 200,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE"
      }
    ]
  };

  if (prompt) {
    requestData.contents[0].parts.push({ text: prompt });
  }

  if (Array.isArray(imageParts)) {
    for (const img of imageParts) {
      requestData.contents[0].parts.push({
        inline_data: {
          mime_type: img.mime_type || "image/jpeg",
          data: img.data
        }
      });
    }
  }

  // Criar a URL com a chave de API
  const apiUrlWithKey = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
  
  // Opções para a requisição HTTP
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(apiUrlWithKey, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`API Error: ${response.error.message}`));
            return;
          }
          
          // Extrair o texto da resposta
          if (response.candidates && response.candidates[0] && 
              response.candidates[0].content && 
              response.candidates[0].content.parts && 
              response.candidates[0].content.parts[0]) {
            resolve(response.candidates[0].content.parts[0].text);
          } else {
            reject(new Error('Formato de resposta inesperado da API Gemini'));
          }
        } catch (error) {
          reject(new Error(`Erro ao processar resposta: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Erro na requisição: ${error.message}`));
    });

    console.log("Payload enviado para a Gemini API:", JSON.stringify(requestData, null, 2));
    
    req.write(JSON.stringify(requestData));
    req.end();
  });
}

// Função para baixar imagem de uma URL e convertê-la para base64

async function downloadImageAsBase64(imageUrl) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = url.parse(imageUrl);
      const httpModule = parsedUrl.protocol === 'https:' ? https : http;
      
      httpModule.get(imageUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Falha ao baixar imagem, status: ${res.statusCode}`));
          return;
        }
        
        sendOutput('info', `Imagem baixada com sucessoaa: ${imageUrl}`);
        
        let contentType = res.headers['content-type'];
        
        sendOutput('info', `type: ${contentType}`);

        // Função para detectar tipo MIME baseado na URL
        function detectMimeTypeFromUrl(url) {
          const extension = url.split('.').pop().toLowerCase();
          const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'svg': 'image/svg+xml'
          };
          return mimeTypes[extension] || 'image/jpeg';
        }
        
        // Função para detectar tipo MIME pelos primeiros bytes
        function detectMimeTypeFromBuffer(buffer) {
          const firstBytes = buffer.slice(0, 12);
          
          // JPEG
          if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8 && firstBytes[2] === 0xFF) {
            return 'image/jpeg';
          }
          // PNG
          if (firstBytes[0] === 0x89 && firstBytes[1] === 0x50 && firstBytes[2] === 0x4E && firstBytes[3] === 0x47) {
            return 'image/png';
          }
          // GIF
          if (firstBytes.slice(0, 3).toString() === 'GIF') {
            return 'image/gif';
          }
          // WebP
          if (firstBytes.slice(0, 4).toString() === 'RIFF' && firstBytes.slice(8, 12).toString() === 'WEBP') {
            return 'image/webp';
          }
          // BMP
          if (firstBytes[0] === 0x42 && firstBytes[1] === 0x4D) {
            return 'image/bmp';
          }
          
          return 'image/jpeg'; // fallback
        }
        
        // Validar e limpar contentType
        if (!contentType || 
            !contentType.startsWith('image/') || 
            contentType.includes('binary/octet-stream') ||
            contentType.includes('application/octet-stream')) {
          // Tentar detectar pela URL primeiro
          contentType = detectMimeTypeFromUrl(imageUrl);
          sendOutput('info', `Content-Type inválido, detectado pela URL: ${contentType}`);
        } else {
          // Limpar contentType removendo parâmetros extras
          contentType = contentType.split(';')[0].trim();
        }
        
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            
            // Se ainda não temos um tipo válido, detectar pelos bytes
            if (!contentType.startsWith('image/') || contentType === 'image/jpeg') {
              const detectedType = detectMimeTypeFromBuffer(buffer);
              if (detectedType !== 'image/jpeg') {
                contentType = detectedType;
                sendOutput('info', `Tipo detectado pelos bytes: ${contentType}`);
              }
            }
            
            // Lista de tipos MIME suportados pelo Gemini
            const supportedMimeTypes = [
              'image/jpeg',
              'image/png', 
              'image/gif',
              'image/webp'
            ];
            
            // Se o tipo não for suportado, converter para JPEG
            if (!supportedMimeTypes.includes(contentType)) {
              contentType = 'image/jpeg';
              sendOutput('info', `Tipo não suportado, usando fallback: ${contentType}`);
            }
            
            const base64Image = buffer.toString('base64');
            
            // Validar se o base64 não está vazio
            if (!base64Image || base64Image.length === 0) {
              reject(new Error('Imagem base64 vazia'));
              return;
            }
            
            sendOutput('info', `Imagem processada - Tipo: ${contentType}, Tamanho: ${base64Image.length} chars`);
            
            resolve({
              data: base64Image,
              mimeType: contentType,
              mime_type: contentType // Gemini usa ambos os formatos
            });
          } catch (error) {
            reject(new Error(`Erro ao processar imagem: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Erro ao baixar imagem: ${error.message}`));
      });
    } catch (error) {
      reject(new Error(`Erro ao configurar download: ${error.message}`));
    }
  });
}

let automationRunning = false;
let automationPaused = false;
let browserView = null;
let mainWindow = null;

// Configurações padrão dos seletores
let config = {
  questionSelector: ".qtext",
  optionsSelector: "input[type=\"radio\"]",
  nextButtonSelector: "input[value=\"Próxima página\"]",
  captureScreenshot: false, // Capturar screenshot
  downloadImages: true      // Baixar imagens da página
};

// Salva a pergunta e resposta no banco de dados
async function saveQuestionAndAnswer(question, answer) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Janela principal não disponível');
  }
  
  return new Promise((resolve, reject) => {
    // Envia um evento IPC para o renderer para salvar a pergunta e resposta
    mainWindow.webContents.send('save-question-answer', {
      pergunta: question,
      resposta: answer
    });
    
    // Configura um listener para receber a confirmação
    const listener = (event, result) => {
      ipcMain.removeListener('save-question-answer-result', listener);
      if (result.success) {
        resolve();
      } else {
        reject(new Error(result.error || 'Erro desconhecido ao salvar pergunta e resposta'));
      }
    };
    
    // Registra o listener para receber a resposta
    ipcMain.once('save-question-answer-result', listener);
    
    // Define um timeout para evitar que o promise fique pendente indefinidamente
    setTimeout(() => {
      ipcMain.removeListener('save-question-answer-result', listener);
      resolve(); // Resolve mesmo sem confirmação para não bloquear a automação
    }, 5000);
  });
}

// Inicializa o módulo de automação
function initAutomation(bView, window) {
  browserView = bView;
  mainWindow = window;
  setupIpcHandlers();
  console.log('[browser_automation.js] Módulo de automação inicializado');
}

// Configura os handlers de IPC para comunicação com o renderer
function setupIpcHandlers() {
  ipcMain.on('start-automation', (event, customConfig) => {
    if (customConfig) {
      config = { ...config, ...customConfig };
    }
    startAutomation();
  });

  ipcMain.on('stop-automation', () => {
    stopAutomation();
  });

  ipcMain.on('pause-automation', () => {
    pauseAutomation();
  });

  ipcMain.on('resume-automation', () => {
    resumeAutomation();
  });

  ipcMain.on('update-automation-config', (event, newConfig) => {
    config = { ...config, ...newConfig };
    sendOutput('info', `Configuração atualizada: ${JSON.stringify(config)}`);
  });

  // Novo handler para capturar screenshot manualmente
  ipcMain.handle('capture-screenshot', async () => {
    return await captureScreenshot();
  });

  // Novo handler para analisar imagem com Gemini
  ipcMain.handle('analyze-image', async (event, imageBase64, promptText) => {
    try {
      const result = await callGeminiAPI(promptText, imageBase64);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // Novo handler para baixar imagem
  ipcMain.handle('download-image', async (event, imageUrl) => {
    try {
      const image = await downloadImageAsBase64(imageUrl);
      return { success: true, data: image };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// Captura screenshot da página atual
async function captureScreenshot() {
  try {
    if (!browserView || !browserView.webContents) {
      throw new Error('BrowserView não está disponível');
    }

    const image = await browserView.webContents.capturePage();
    const pngData = image.toPNG();
    
    // Converter para base64
    const base64Image = pngData.toString('base64');
    
    sendOutput('info', 'Screenshot capturado com sucesso');
    return base64Image;
  } catch (error) {
    sendOutput('error', `Erro ao capturar screenshot: ${error.message}`);
    return null;
  }
}

// Encontra todas as imagens na página atual e extrai seus URLs
async function extractImagesFromPage() {
  try {
    if (!browserView || !browserView.webContents) {
      throw new Error('BrowserView não está disponível');
    }
    
    const imagesInfo = await browserView.webContents.executeJavaScript(`
      (function() {
        const images = document.querySelectorAll('.qtext img, .content img');
        const result = [];
        const blockedDomain = 'https://www.avaeduc.com.br/blocks';
        
        for (const img of images) {
          // Filtrar imagens que contêm o domínio bloqueado
          if (!img.src.includes(blockedDomain)) {
            result.push({
              src: img.src,
              alt: img.alt || '',
              width: img.width,
              height: img.height
            });
          } else {
            console.log('Imagem filtrada (bloqueada):', img.src);
          }
        }
        
        return result;
      })();
    `);
    
    if (imagesInfo && imagesInfo.length > 0) {
      sendOutput('info', `Encontradas ${imagesInfo.length} imagens válidas na página (filtradas as do domínio blocks)`);
      return imagesInfo;
    } else {
      sendOutput('info', 'Nenhuma imagem válida encontrada na página após filtros');
      return [];
    }
  } catch (error) {
    sendOutput('error', `Erro ao extrair imagens da página: ${error.message}`);
    return [];
  }
}

// Inicia o processo de automação
async function startAutomation() {
  if (automationRunning) {
    console.log('[browser_automation.js] Automação já está em execução');
    return;
  }

  if (!browserView || !browserView.webContents) {
    console.error('[browser_automation.js] BrowserView não está disponível');
    sendOutput('error', 'BrowserView não está disponível. Inicialize o navegador primeiro.');
    return;
  }

  automationRunning = true;
  automationPaused = false;
  sendStatus('started');
  sendOutput('info', 'Automação iniciada');

  try {
    // Loop principal da automação
    while (automationRunning) {
      // Verifica se está pausado
      if (automationPaused) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      sendOutput('info', '--- Nova Iteração ---');
      
      try {
        // Extrai a pergunta e opções da página atual
        let { question, options } = await getQuestionAndOptions();
        
        // Variáveis para armazenar informações de imagens
        let imageBase64 = null;
        let mimeType = 'image/jpeg';
        
        // Captura screenshot se configurado para isso
        if (config.captureScreenshot) {
          sendOutput('info', 'Capturando screenshot da página...');
          imageBase64 = await captureScreenshot();
        }
        
        let imageParts = [];

        if (config.downloadImages) {
          const images = await extractImagesFromPage();

          if (images.length > 0) {
            sendOutput('info', `Tentando baixar ${images.length} imagens...`);

            for (const img of images) {
              try {
                const imageInfo = await downloadImageAsBase64(img.src);
                imageParts.push({
                  mime_type: imageInfo.mimeType,
                  data: imageInfo.data
                });
                sendOutput('info', `Imagem baixada com sucesso: ${img.src.substring(0, 50)}...`);
              } catch (error) {
                sendOutput('warning', `Erro ao baixar imagem: ${img.src.substring(0, 50)} (${error.message})`);
              }
            }

            if (imageParts.length === 0) {
              sendOutput('warning', 'Nenhuma imagem pôde ser baixada. Continuando apenas com texto.');
            }
          }
        }

        if (!question && !options.length && !imageBase64) {
          sendOutput('warning', 'Não foi possível encontrar pergunta, opções ou imagem. Verificando novamente em 5s...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        if (question) {
          sendOutput('info', `Pergunta encontrada: ${question.substring(0, 50)}...`);
        }
        
        if (options.length) {
          sendOutput('info', `Opções encontradas: ${JSON.stringify(options)}`);
        }

        // Prepara o prompt para o Gemini
        let prompt;

        if (question && options.length && imageParts.length > 0) {
          // Se temos pergunta, opções e imagem
          prompt = `Qual alternativa está correta? RESPONDA APENAS A LETRA MAIÚSCULA (A, B, C, D ou E)
          
          PERGUNTA: ${question}
          
          ALTERNATIVAS:
          ${options.map(opt => `${opt.letter.toUpperCase()}) ${opt.cleanText}`).join('\n')}
          
          RESPONDA APENAS A LETRA MAIÚSCULA (A, B, C, D ou E):`;
        
        } else if (question && options.length) {
          // Se temos apenas pergunta e opções (sem imagem)
          prompt = `Qual alternativa está correta? RESPONDA APENAS A LETRA MAIÚSCULA (A, B, C, D ou E)
          
          QUESTÃO: ${question}
          
          OPÇÕES:
          ${options.map(opt => `${opt.letter.toUpperCase()}) ${opt.cleanText}`).join('\n')}
          
          RESPONDA APENAS A LETRA MAIÚSCULA (A, B, C, D ou E):`;
        
        } else if (imageBase64) {
          // Se só temos a imagem
          prompt = `Qual alternativa está correta?
          
          RESPONDA APENAS A LETRA MAIÚSCULA (A, B, C, D ou E) DA ALTERNATIVA CORRETA:`;
        }

        // Obtém a resposta do Gemini
        const correctOption = await getGeminiAnswer(prompt, imageParts, options);

        if (!correctOption) {
          sendOutput('error', 'Não foi possível obter resposta do Gemini. Parando automação.');
          stopAutomation();
          break;
        }

        // Seleciona a resposta e avança
const success = await selectAnswerAndNext(correctOption);

if (!success) {
  sendOutput('error', 'Falha ao selecionar resposta ou avançar. Parando automação.');
  stopAutomation();
  break;
}

// Salva a pergunta e resposta no banco de dados
if (question && correctOption && correctOption.rawAnswer) {
  try {
    await saveQuestionAndAnswer(question, correctOption.rawAnswer, options);
    sendOutput('info', 'Pergunta e resposta salvas no banco de dados.');
  } catch (error) {
    sendOutput('warning', `Erro ao salvar pergunta e resposta: ${error.message}`);
  }
}

        // Pausa entre perguntas
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        sendOutput('error', `Erro durante a automação: ${error.message}`);
        // Continua tentando em caso de erro
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    sendOutput('error', `Erro fatal na automação: ${error.message}`);
    stopAutomation();
  }
}

// Extrai a pergunta e opções da página atual
async function getQuestionAndOptions() {
  try {
    const result = await browserView.webContents.executeJavaScript(`
      (function() {
        try {
          // Extrai a pergunta
          const questionElement = document.querySelector('${config.questionSelector}');
          if (!questionElement) return { question: null, options: [], hasImage: false, imageUrls: [] };
          const questionText = questionElement.textContent.trim();

          // Verifica se há imagens na pergunta
          const images = questionElement.querySelectorAll('img');
          const hasImage = images.length > 0;
          const imageUrls = Array.from(images).map(img => img.src).filter(src => src);

          // Extrai as opções
          const optionElements = document.querySelectorAll('${config.optionsSelector}');
          const options = [];

          for (const option of optionElements) {
            let optionText = "";
            
            // Tenta encontrar o texto da opção em diferentes elementos
            try {
              // Tenta encontrar o label pai
              const label = option.closest('label');
              if (label) {
                optionText = label.textContent.trim();
              } else {
                // Tenta encontrar o label associado
                const id = option.id;
                if (id) {
                  const associatedLabel = document.querySelector(\`label[for="\${id}"]\`);
                  if (associatedLabel) {
                    optionText = associatedLabel.textContent.trim();
                  }
                }
                
                // Tenta encontrar span irmão
                if (!optionText) {
                  const parentElement = option.parentElement;
                  if (parentElement) {
                    const span = parentElement.querySelector('span');
                    if (span) {
                      optionText = span.textContent.trim();
                    }
                  }
                }
                
                // Fallback para o valor do input
                if (!optionText) {
                  optionText = option.value || "Opção sem texto";
                }
              }
            } catch (e) {
              optionText = option.value || "Erro ao extrair texto";
            }
            
            if (optionText) {
              // Extrai a letra e o texto limpo
              const cleanText = optionText.replace(/^[a-e][.\\s]*\\s*/i, '').trim();
              const letterMatch = optionText.match(/^([a-e])[.\\s]*/i);
              const letter = letterMatch ? letterMatch[1].toLowerCase() : String.fromCharCode(97 + options.length);
              
              options.push({
                text: optionText,
                cleanText: cleanText,
                letter: letter,
                value: option.value,
                id: option.id
              });
            }
          }
          
          return { question: questionText, options: options, hasImage: hasImage, imageUrls: imageUrls };
        } catch (error) {
          console.error('Erro ao extrair pergunta/opções:', error);
          return { question: null, options: [], error: error.toString(), hasImage: false, imageUrls: [] };
        }
      })();
    `);
    
    return {
      question: result.question,
      options: result.options,
      hasImage: result.hasImage,
      imageUrls: result.imageUrls || []
    };
  } catch (error) {
    console.error('[browser_automation.js] Erro ao executar script para extrair pergunta/opções:', error);
    return { question: null, options: [], hasImage: false, imageUrls: [] };
  }
}

// Função para salvar a pergunta e resposta no banco de dados
async function saveQuestionAndAnswer(question, answer, options) {
  try {
    sendOutput('info', 'Salvando pergunta e resposta no banco de dados...');
    
    // Formata as opções como texto para armazenamento
    let optionsText = '';
    if (options && options.length > 0) {
      optionsText = options.map(opt => `${opt.letter}: ${opt.text || opt.cleanText}`).join('\n');
    }
    
    // Tenta extrair disciplina e módulo da URL ou do conteúdo da página
    let disciplina = null;
    let modulo = null;
    
    // Tenta extrair do título da página ou da URL
    try {
      const pageUrl = browserView.webContents.getURL();
      const pageTitle = await browserView.webContents.executeJavaScript('document.title');
      
      // Extrai informações do título ou URL (exemplo simplificado)
      // Aqui você pode implementar uma lógica mais sofisticada baseada na estrutura do site
      if (pageTitle) {
        // Exemplo: "Disciplina - Módulo X: Título da Aula"
        const titleMatch = pageTitle.match(/([^-:]+)\s*[-:]\s*([^:]+)/);
        if (titleMatch) {
          disciplina = titleMatch[1].trim();
          modulo = titleMatch[2].trim();
        }
      }
      
      // Se não conseguiu extrair do título, tenta da URL
      if (!disciplina && pageUrl) {
        // Exemplo: extrair de URLs como /cursos/python/modulo-2/
        const urlMatch = pageUrl.match(/\/cursos\/([^\/]+)\/([^\/]+)\//i);
        if (urlMatch) {
          disciplina = urlMatch[1].replace(/-/g, ' ');
          modulo = urlMatch[2].replace(/-/g, ' ');
        }
      }
    } catch (e) {
      sendOutput('warning', `Não foi possível extrair metadados: ${e.message}`);
    }
    
    // Envia para o processo principal via IPC
    ipcMain.emit('save-question-answer', null, {
      pergunta: question,
      resposta: answer,
      opcoes: optionsText,
      disciplina: disciplina,
      modulo: modulo
    });
    
    sendOutput('info', 'Solicitação de salvamento enviada.');
    return true;
  } catch (error) {
    sendOutput('error', `Erro ao salvar pergunta e resposta: ${error.message}`);
    return false;
  }
}

// Obtém a resposta do Gemini
async function getGeminiAnswer(prompt, imageParts = [], options = []) {
  try {
    sendOutput('info', 'Enviando prompt para Gemini...');
    
    // Usar a função callGeminiAPI implementada no início do arquivo
    const answerText = await callGeminiAPI(prompt, imageParts);
    
    sendOutput('info', `Resposta recebida do Gemini: ${answerText}`);
    
    // Extrai apenas a letra da resposta (caso o modelo retorne mais que apenas a letra)
    const letterMatch = answerText.trim().match(/\b([a-e])\b/i);
    if (letterMatch) {
      return { type: 'letter', value: letterMatch[1].toLowerCase(), rawAnswer: answerText };
    }
    
    // Tenta extrair de outros formatos
    const altMatch = answerText.match(/\(([a-e])\)|([a-e])\)|letra\s*([a-e])|opção\s*([a-e])/i);
    if (altMatch) {
      return { type: 'letter', value: (altMatch[1] || altMatch[2] || altMatch[3] || altMatch[4]).toLowerCase(), rawAnswer: answerText };
    }
    
    // Se não encontrou letra, tenta índice
    const indexMatch = answerText.match(/\b([0-4])\b/);
    if (indexMatch) {
      return { type: 'index', value: parseInt(indexMatch[1]), rawAnswer: answerText };
    }
    
    // Tenta correspondência por conteúdo se temos opções
    if (options && options.length > 0) {
      const answerLower = answerText.toLowerCase();
      for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const optionTextLower = (option.cleanText || option.text || '').toLowerCase();
        
        // Verifica se a resposta contém partes significativas da opção
        const words = optionTextLower.split(/\s+/).filter(word => word.length > 3);
        let matchCount = 0;
        
        for (const word of words) {
          if (answerLower.includes(word)) {
            matchCount++;
          }
        }
        
        // Se mais de 50% das palavras significativas coincidem
        if (words.length > 0 && matchCount / words.length > 0.5) {
          return { type: 'letter', value: option.letter, rawAnswer: answerText };
        }
      }
    }

    sendOutput('error', `O Gemini não retornou uma resposta válida: "${answerText}"`);
    return null;
  } catch (error) {
    sendOutput('error', `Erro ao obter resposta do Gemini: ${error.message}`);
    return null;
  }
}

// Função para finalizar o quiz clicando no botão "Enviar tudo e terminar"
async function finalizarQuiz() {
  try {
    sendOutput('info', 'Tentando finalizar o quiz...');
    
    // Primeira tentativa
    let confirmResult = await browserView.webContents.executeJavaScript(`
      (function() {
        try {
          console.log('Tentando encontrar botão de confirmação final...');
          
          const confirmButtons = document.querySelectorAll('.confirmation-buttons button');
          for (const button of confirmButtons) {
            if (button.textContent.includes('Enviar tudo e terminar')) {
              button.click();
              return { success: true, message: 'Confirmação final enviada (botão dialog)' };
            }
          }
    
          // Procura especificamente pelo botão "Enviar tudo e terminar" evitando o "Retornar à tentativa"
          const allButtons = document.querySelectorAll('button.btn.btn-secondary[type="submit"], button.btn.btn-secondary');
          for (const btn of allButtons) {
            if (btn.textContent.trim() === 'Enviar tudo e terminar') {
              btn.click();
              return { success: true, message: 'Confirmação final enviada (botão Enviar tudo e terminar)' };
            }
          }
          
          // Procura pelo botão dentro de um form que aponta para processattempt.php
          const processForm = document.querySelector('form[action*="processattempt.php"]');
          if (processForm) {
            const submitBtn = processForm.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
              return { success: true, message: 'Confirmação final enviada (botão dentro do form processattempt)' };
            }
          }
    
          const anyButton = Array.from(document.querySelectorAll('.btn.btn-secondary')).find(btn => 
            btn.textContent.includes('Enviar tudo e terminar'));
          if (anyButton) {
            anyButton.click();
            return { success: true, message: 'Confirmação final enviada (botão secundário)' };
          }
    
          const submitForm = document.querySelector('form[action*="processattempt.php"]');
          if (submitForm) {
            submitForm.submit();
            return { success: true, message: 'Confirmação final enviada (via formulário)' };
          }
    
          // Fallback final se nenhum método funcionar
          return { success: false, error: 'Nenhum botão ou formulário encontrado para confirmação final' };
        } catch (error) {
          return { success: false, error: error.toString() };
        }
      })();
    `);
    
    if (confirmResult && confirmResult.success) {
      sendOutput('info', `Confirmação final: ${confirmResult.message || 'Enviado com sucesso'}`);
      return true;
    }
    
    // Se falhou, aguarda e tenta novamente
    sendOutput('warning', 'Primeira tentativa falhou. Aguardando 2 segundos e tentando novamente...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Segunda tentativa
    confirmResult = await browserView.webContents.executeJavaScript(`
      (function() {
        try {
          // Procura especificamente pelo botão "Enviar tudo e terminar" evitando o "Retornar à tentativa"
          const allButtons = document.querySelectorAll('button.btn.btn-secondary[type="submit"], button.btn.btn-secondary');
          for (const btn of allButtons) {
            if (btn.textContent.trim() === 'Enviar tudo e terminar') {
              btn.click();
              return { success: true, message: 'Botão Enviar tudo e terminar clicado com sucesso (segunda tentativa)' };
            }
          }
          
          // Procura pelo botão dentro de um form que aponta para processattempt.php
          const processForm = document.querySelector('form[action*="processattempt.php"]');
          if (processForm) {
            const submitBtn = processForm.querySelector('button[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
              return { success: true, message: 'Botão dentro do form processattempt clicado com sucesso (segunda tentativa)' };
            }
          }
          
          const submitForm = document.querySelector('form[action*="processattempt.php"]');
          if (submitForm) {
            submitForm.submit();
            return { success: true, message: 'Formulário enviado com sucesso (segunda tentativa)' };
          }
          
          return { success: false, error: 'Botão de confirmação não encontrado (segunda tentativa)' };
        } catch (error) {
          return { success: false, error: error.toString() };
        }
      })();
    `);
    
    if (confirmResult && confirmResult.success) {
      sendOutput('info', `Confirmação final: ${confirmResult.message || 'Enviado com sucesso'}`);
      return true;
    }
    
    // Se ainda falhou, aguarda mais e tenta uma terceira vez
    sendOutput('warning', 'Segunda tentativa falhou. Aguardando mais 2 segundos e tentando novamente...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Terceira tentativa
    confirmResult = await browserView.webContents.executeJavaScript(`
      (function() {
        try {
          // Tenta usar YUI para simular o clique especificamente no botão "Enviar tudo e terminar"
          if (typeof Y !== 'undefined') {
            const submitButtons = Y.all('button.btn.btn-secondary[type="submit"], button.btn.btn-secondary');
            if (submitButtons && submitButtons.size() > 0) {
              // Procura pelo botão com o texto correto
              let found = false;
              submitButtons.each(function(btn) {
                if (btn.get('text').trim() === 'Enviar tudo e terminar') {
                  btn.simulate('click');
                  found = true;
                  return false; // Interrompe o loop
                }
              });
              
              if (found) {
                return { success: true, message: 'Botão Enviar tudo e terminar clicado via YUI (terceira tentativa)' };
              }
              
              // Se não encontrou o botão específico, tenta encontrar o form correto
              const processForm = Y.one('form[action*="processattempt.php"]');
              if (processForm) {
                const submitBtn = processForm.one('button[type="submit"]');
                if (submitBtn) {
                  submitBtn.simulate('click');
                  return { success: true, message: 'Botão dentro do form processattempt clicado via YUI (terceira tentativa)' };
                }
              }
            }
          }
          
          // Tenta enviar o formulário diretamente
          const forms = document.querySelectorAll('form');
          for (const form of forms) {
            if (form.action && form.action.includes('processattempt.php')) {
              form.submit();
              return { success: true, message: 'Formulário enviado diretamente (terceira tentativa)' };
            }
          }
          
          return { success: false, error: 'Todas as tentativas falharam' };
        } catch (error) {
          return { success: false, error: error.toString() };
        }
      })();
    `);
    
    if (confirmResult && confirmResult.success) {
      sendOutput('info', `Confirmação final: ${confirmResult.message || 'Enviado com sucesso'}`);
      return true;
    }
    
    sendOutput('error', 'Não foi possível finalizar o quiz após múltiplas tentativas');
    return false;
  } catch (error) {
    sendOutput('error', `Erro ao finalizar quiz: ${error.toString()}`);
    return false;
  }
}

// Seleciona a resposta e clica no botão próximo ou finaliza o quiz
async function selectAnswerAndNext(correctAnswer) {
  try {
    let selectResult;
    
    // Lida com diferentes tipos de resposta
    if (correctAnswer && correctAnswer.type === 'index') {
      // Seleção direta por índice para questões baseadas em imagem
      selectResult = await browserView.webContents.executeJavaScript(`
        (function() {
          try {
            const optionElements = document.querySelectorAll('${config.optionsSelector}');
            
            const index = ${correctAnswer.value};
            if (index >= 0 && index < optionElements.length) {
              optionElements[index].click();
              return { success: true };
            } else {
              return { success: false, error: 'Índice fora dos limites' };
            }
          } catch (error) {
            return { success: false, error: error.toString() };
          }
        })();
      `);
      
      if (selectResult.success) {
        sendOutput('info', `Opção ${correctAnswer.value} selecionada com sucesso.`);
      }
    } else if (correctAnswer && correctAnswer.type === 'letter') {
      // Seleção por letra com correspondência fuzzy
      const targetLetter = correctAnswer.value.toLowerCase();
      
      selectResult = await browserView.webContents.executeJavaScript(`
        (function() {
          try {
            const optionElements = document.querySelectorAll('${config.optionsSelector}');
            let selected = false;
            
            for (const option of optionElements) {
              let optionText = "";
              
              // Extrai o texto da opção
              try {
                const label = option.closest('label');
                if (label) {
                  optionText = label.textContent.trim();
                } else {
                  const id = option.id;
                  if (id) {
                    const associatedLabel = document.querySelector(\`label[for="\${id}"]\`);
                    if (associatedLabel) {
                      optionText = associatedLabel.textContent.trim();
                    }
                  }
                  
                  if (!optionText) {
                    const parentElement = option.parentElement;
                    if (parentElement) {
                      const span = parentElement.querySelector('span');
                      if (span) {
                        optionText = span.textContent.trim();
                      }
                    }
                  }
                  
                  if (!optionText) {
                    optionText = option.value || "";
                  }
                }
              } catch (e) {
                optionText = option.value || "";
              }
              
              const optionTextLower = optionText.toLowerCase();
              
              // Tenta várias variações de correspondência de letra
              const letterPatterns = [
                new RegExp(\`^\\\\s*${targetLetter}\\\\s*[.)]?\\\\s*\`, 'i'),
                new RegExp(\`^\\\\s*${targetLetter}[.)]\\\\s*\`, 'i'),
                new RegExp(\`^\\\\s*${targetLetter}\\\\s*[.-]\\\\s*\`, 'i'),
                new RegExp(\`\\\\b${targetLetter}\\\\b\`, 'i')
              ];
              
              for (const pattern of letterPatterns) {
                if (pattern.test(optionTextLower)) {
                  option.click();
                  selected = true;
                  break;
                }
              }
              
              if (selected) break;
            }
            
            // Se não encontrou por padrão, tenta por índice baseado na letra
            if (!selected) {
              const letterIndex = '${targetLetter}'.charCodeAt(0) - 97; // 'a' = 0, 'b' = 1, etc.
              if (letterIndex >= 0 && letterIndex < optionElements.length) {
                optionElements[letterIndex].click();
                selected = true;
              }
            }
            
            return { success: selected, error: selected ? null : 'Não foi possível encontrar a opção correta' };
          } catch (error) {
            return { success: false, error: error.toString() };
          }
        })();
      `);
      
      if (selectResult.success) {
        sendOutput('info', `Opção ${targetLetter} selecionada com sucesso.`);
      }
    } else {
      // Compatibilidade com formato antigo
      const correctOption = correctAnswer.value || correctAnswer;
      
      if (typeof correctOption === 'number') {
        selectResult = await browserView.webContents.executeJavaScript(`
          (function() {
            try {
              const optionElements = document.querySelectorAll('${config.optionsSelector}');
              
              const index = ${correctOption};
              if (index >= 0 && index < optionElements.length) {
                optionElements[index].click();
                return { success: true };
              } else {
                return { success: false, error: 'Índice fora dos limites' };
              }
            } catch (error) {
              return { success: false, error: error.toString() };
            }
          })();
        `);
      } else {
        selectResult = await browserView.webContents.executeJavaScript(`
          (function() {
            try {
              const optionElements = document.querySelectorAll('${config.optionsSelector}');
              let selected = false;
              
              for (const option of optionElements) {
                let optionText = "";
                
                try {
                  const label = option.closest('label');
                  if (label) {
                    optionText = label.textContent.trim();
                  } else {
                    const id = option.id;
                    if (id) {
                      const associatedLabel = document.querySelector(\`label[for="\${id}"]\`);
                      if (associatedLabel) {
                        optionText = associatedLabel.textContent.trim();
                      }
                    }
                    
                    if (!optionText) {
                      const parentElement = option.parentElement;
                      if (parentElement) {
                        const span = parentElement.querySelector('span');
                        if (span) {
                          optionText = span.textContent.trim();
                        }
                      }
                    }
                    
                    if (!optionText) {
                      optionText = option.value || "";
                    }
                  }
                } catch (e) {
                  optionText = option.value || "";
                }
                
                if (optionText.toLowerCase() === "${correctOption.replace(/\\/g, '\\\\').replace(/"/g, '\\"').toLowerCase()}") {
                  // Seleciona a opção
                  option.click();
                  selected = true;
                  break;
                }
              }
              
              return { success: selected, error: selected ? null : 'Não foi possível encontrar a opção correta' };
            } catch (error) {
              return { success: false, error: error.toString() };
            }
          })();
        `);
      }
    }
    
    // Pequena pausa após selecionar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verifica se o botão "Próxima página" existe
    const navigationResult = await browserView.webContents.executeJavaScript(`
      (function() {
        try {
          // Verifica se estamos na página de resumo/confirmação
          const summaryPage = document.querySelector('.quizsummaryofattempt');
          if (summaryPage) {
            return { success: true, action: 'summary', message: 'Página de resumo detectada' };
          }
          
          // Procura pelo botão "Próxima página"
          const nextButton = document.querySelector('${config.nextButtonSelector}');
          
          if (nextButton) {
            // Se encontrou o botão normal de próxima página
            nextButton.click();
            return { success: true, action: 'next', message: 'Avançado para próxima página' };
          } else {
            // Se não encontrou o botão normal, procura pelo botão ">"
            const nextNavButton = document.querySelector('input[value=">"]');
            
            if (nextNavButton) {
              // Se encontrou o botão de navegação ">"
              nextNavButton.click();
              return { success: true, action: 'nav-next', message: 'Avançado para próxima seção usando botão >' };
            } else {
              // Se não encontrou o botão de navegação, procura pelo botão "Enviar tudo e terminar" ou "Finalizar tentativa"
              // Primeiro procura especificamente pelo botão com o texto "Enviar tudo e terminar"
              const allButtons = document.querySelectorAll('button.btn.btn-secondary');
              let foundFinishButton = false;
              
              for (const btn of allButtons) {
                if (btn.textContent.trim() === 'Enviar tudo e terminar') {
                  btn.click();
                  foundFinishButton = true;
                  return { success: true, action: 'finish', message: 'Clicado no botão Enviar tudo e terminar' };
                }
              }
              
              // Se não encontrou pelo texto, procura pelo botão dentro do form correto
              const processForm = document.querySelector('form[action*="processattempt.php"]');
              if (processForm) {
                const submitBtn = processForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                  submitBtn.click();
                  return { success: true, action: 'finish', message: 'Clicado no botão de finalização dentro do form processattempt' };
                }
              }
              
              // Fallback para os seletores antigos
              const submitButton = document.querySelector('input[value="Enviar tudo e terminar"], input[value="Finalizar tentativa"], input[value="Finalizar tentativa ..."]');
              
              if (submitButton) {
                // Se encontrou o botão de finalização
                submitButton.click();
                return { success: true, action: 'finish', message: 'Clicado no botão de finalização (fallback)' };
              } else {
                // Verifica se já está na tela de confirmação de envio
                const confirmDialog = document.querySelector('.confirmation-dialogue');
                if (confirmDialog) {
                  // Clica no botão de confirmação final
                  const confirmButton = document.querySelector('.confirmation-buttons input[value="Enviar tudo e terminar"], .confirmation-buttons input[value="Finalizar tentativa"], .confirmation-buttons input[value="Finalizar tentativa ..."], .confirmation-buttons button.btn.btn-secondary');
                  if (confirmButton) {
                    confirmButton.click();
                    return { success: true, action: 'confirm', message: 'Confirmado envio final' };
                  }
                }
                
                // Se não encontrou nenhum botão, verifica se há resultados da avaliação (tela final)
                const resultPage = document.querySelector('.quizreviewsummary');
                if (resultPage) {
                  return { success: true, action: 'completed', message: 'Quiz já foi completado' };
                }
                
                return { success: false, error: 'Nenhum botão de navegação encontrado' };
              }
            }
          }
        } catch (error) {
          return { success: false, error: error.toString() };
        }
      })();
    `);
    
    if (!navigationResult.success) {
      sendOutput('error', `Falha na navegação: ${navigationResult.error}`);
      return false;
    }
    
    sendOutput('info', navigationResult.message);
    
    // Se estamos na página de resumo, tenta finalizar o quiz
    if (navigationResult.action === 'summary') {
      // Aguarda 2 segundos para garantir que a página carregou completamente
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await finalizarQuiz();
    }
    
    // Se estamos na etapa de confirmação final, lida com o diálogo de confirmação
    if (navigationResult.action === 'finish') {
      // Aguarda 2 segundos para garantir que o diálogo apareceu
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await finalizarQuiz();
    }
    
    return true;
  } catch (error) {
    sendOutput('error', `Erro ao executar script para selecionar resposta/navegar: ${error.message}`);
    return false;
  }
}

// Pausa a automação
function pauseAutomation() {
  if (automationRunning && !automationPaused) {
    automationPaused = true;
    sendStatus('paused');
    sendOutput('info', 'Automação pausada');
  }
}

// Retoma a automação
function resumeAutomation() {
  if (automationRunning && automationPaused) {
    automationPaused = false;
    sendStatus('resumed');
    sendOutput('info', 'Automação retomada');
  }
}

// Para a automação
function stopAutomation() {
  automationRunning = false;
  automationPaused = false;
  sendStatus('stopped');
  sendOutput('info', 'Automação parada');
}

// Envia o status da automação para o renderer
function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('automation-status', { status });
  }
}

// Envia saída da automação para o renderer
function sendOutput(type, data) {
  console.log(`[browser_automation.js] ${type.toUpperCase()}: ${data}`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('automation-output', { type, data });
  }
}

module.exports = {
  initAutomation,
  startAutomation,
  stopAutomation,
  pauseAutomation,
  resumeAutomation,
  finalizarQuiz,
  captureScreenshot,
  downloadImageAsBase64,
  analyzeImage: async (imageBase64, prompt) => callGeminiAPI(prompt, imageBase64)
};