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
async function callGeminiAPI(prompt, imageBase64 = null) {
  let requestData = {
    contents: [{
      parts: []
    }],
    generationConfig: {
      temperature: 0.4,
      topP: 0.8,
      topK: 40
    }
  };

  // Adicionar texto ao prompt
  if (prompt) {
    requestData.contents[0].parts.push({
      text: prompt
    });
  }

  // Adicionar imagem ao prompt se fornecida
  if (imageBase64) {
    // Adiciona a imagem como parte do conteúdo
    requestData.contents[0].parts.push({
      inline_data: {
        mime_type: "image/jpeg", // Ajuste conforme necessário (image/png, etc.)
        data: imageBase64
      }
    });
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
        
        const contentType = res.headers['content-type'];
        const chunks = [];
        
        res.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const base64Image = buffer.toString('base64');
            resolve({
              data: base64Image,
              mimeType: contentType || 'image/jpeg'
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
        
        for (const img of images) {
          result.push({
            src: img.src,
            alt: img.alt || '',
            width: img.width,
            height: img.height
          });
        }
        
        return result;
      })();
    `);
    
    if (imagesInfo && imagesInfo.length > 0) {
      sendOutput('info', `Encontradas ${imagesInfo.length} imagens na página`);
      return imagesInfo;
    } else {
      sendOutput('info', 'Nenhuma imagem encontrada na página');
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
        
        // Baixa imagens se configurado para isso
        if (config.downloadImages) {
          const images = await extractImagesFromPage();
          
          if (images.length > 0) {
            sendOutput('info', `Baixando ${images.length} imagens...`);
            
            // Pega a primeira imagem (geralmente a mais relevante na questão)
            try {
              const imageInfo = await downloadImageAsBase64(images[0].src);
              imageBase64 = imageInfo.data;
              mimeType = imageInfo.mimeType;
              sendOutput('info', `Imagem baixada com sucesso: ${images[0].src.substring(0, 50)}...`);
            } catch (error) {
              sendOutput('error', `Erro ao baixar imagem: ${error.message}`);
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
        if (question && options.length && imageBase64) {
          // Se temos pergunta, opções e imagem
          prompt = `Analise cuidadosamente esta imagem e responda à seguinte pergunta de múltipla escolha. Retorne APENAS a letra (a, b, c, d ou e) correspondente à alternativa correta, sem pontos ou texto adicional.\n\nPergunta: ${question}\n\nOpções:\n${options.map(opt => `- ${opt}`).join('\n')}`;
        } else if (question && options.length) {
          // Se temos apenas pergunta e opções (sem imagem)
          prompt = `Dada a seguinte pergunta de múltipla escolha e suas opções, qual é a resposta correta? Retorne APENAS a letra (a, b, c, d ou e) correspondente à alternativa correta, sem pontos ou texto adicional.\n\nPergunta: ${question}\n\nOpções:\n${options.map(opt => `- ${opt}`).join('\n')}`;
        } else if (imageBase64) {
          // Se só temos a imagem
          prompt = "Vejo uma questão de múltipla escolha nesta imagem. Por favor, analise a questão e as alternativas. Responda apenas com a letra da alternativa correta (a, b, c, d ou e), sem explicações adicionais.";
        }

        // Obtém a resposta do Gemini
        const correctOption = await getGeminiAnswer(prompt, imageBase64, options);
        
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
          if (!questionElement) return { question: null, options: [] };
          const questionText = questionElement.textContent.trim();

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
              options.push({
                text: optionText,
                value: option.value,
                id: option.id
              });
            }
          }
          
          return { question: questionText, options: options };
        } catch (error) {
          console.error('Erro ao extrair pergunta/opções:', error);
          return { question: null, options: [], error: error.toString() };
        }
      })();
    `);
    
    return {
      question: result.question,
      options: result.options.map(opt => opt.text)
    };
  } catch (error) {
    console.error('[browser_automation.js] Erro ao executar script para extrair pergunta/opções:', error);
    return { question: null, options: [] };
  }
}

// Obtém a resposta do Gemini
async function getGeminiAnswer(prompt, imageBase64 = null, options = []) {
  try {
    sendOutput('info', 'Enviando prompt para Gemini...');
    
    // Usar a função callGeminiAPI implementada no início do arquivo
    const answerText = await callGeminiAPI(prompt, imageBase64);
    
    sendOutput('info', `Resposta recebida do Gemini: ${answerText}`);
    
    // Extrai apenas a letra da resposta (caso o modelo retorne mais que apenas a letra)
    const letterMatch = answerText.trim().match(/^[a-e]/i);
    const answerLetter = letterMatch ? letterMatch[0].toLowerCase() : null;
    
    if (!answerLetter) {
      sendOutput('error', `O Gemini não retornou uma letra válida: "${answerText}"`);
      return null;
    }

    // Se estamos trabalhando com imagem e não temos opções extraídas
    if (options.length === 0) {
      // Tenta selecionar diretamente pelo índice
      const index = answerLetter.charCodeAt(0) - 'a'.charCodeAt(0);
      return { index: index, letter: answerLetter };
    }
    
    // Encontra a opção que começa com a letra retornada
    for (const option of options) {
      if (option.trim().toLowerCase().startsWith(answerLetter + '.')) {
        sendOutput('info', `Opção correspondente encontrada: ${option}`);
        return option;
      }
    }
    
    sendOutput('error', `Não foi possível encontrar uma opção iniciada com a letra "${answerLetter}".`);
    return null;
  } catch (error) {
    sendOutput('error', `Erro ao obter resposta do Gemini: ${error.message}`);
    return null;
  }
}

// Seleciona a resposta e clica no botão próximo
// Seleciona a resposta e clica no botão próximo ou finaliza o quiz
async function selectAnswerAndNext(correctOption) {
  try {
    // Seleciona a resposta (mantendo o código existente)
    // Se correctOption é um objeto com índice (caso de análise de imagem)
    if (typeof correctOption === 'object' && correctOption.index !== undefined) {
      const selectResult = await browserView.webContents.executeJavaScript(`
        (function() {
          try {
            const optionElements = document.querySelectorAll('${config.optionsSelector}');
            
            // Seleciona pelo índice
            const index = ${correctOption.index};
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
      
      if (!selectResult.success) {
        sendOutput('error', `Falha ao selecionar opção: ${selectResult.error}`);
        return false;
      }
      
      sendOutput('info', `Opção ${correctOption.letter} selecionada com sucesso.`);
    } else {
      // Caso normal com texto da opção
      const selectResult = await browserView.webContents.executeJavaScript(`
        (function() {
          try {
            const optionElements = document.querySelectorAll('${config.optionsSelector}');
            let selected = false;
            
            for (const option of optionElements) {
              let optionText = "";
              
              // Tenta encontrar o texto da opção
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
              
              if (optionText.toLowerCase() === \`${correctOption.toLowerCase().replace(/'/g, "\\'").replace(/"/g, '\\"')}\`) {
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
      
      if (!selectResult.success) {
        sendOutput('error', `Falha ao selecionar opção: ${selectResult.error}`);
        return false;
      }
      
      sendOutput('info', 'Resposta selecionada com sucesso.');
    }
    
    // Pequena pausa após selecionar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verifica se o botão "Próxima página" existe
    const navigationResult = await browserView.webContents.executeJavaScript(`
      (function() {
        try {
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
              // Se não encontrou o botão de navegação, procura pelo botão "Enviar tudo e terminar"
              const submitButton = document.querySelector('input[value="Enviar tudo e terminar"]');
              
              if (submitButton) {
                // Se encontrou o botão de finalização
                submitButton.click();
                return { success: true, action: 'finish', message: 'Clicado no botão Enviar tudo e terminar' };
              } else {
                // Verifica se já está na tela de confirmação de envio
                const confirmDialog = document.querySelector('.confirmation-dialogue');
                if (confirmDialog) {
                  // Clica no botão de confirmação final
                  const confirmButton = document.querySelector('.confirmation-buttons input[value="Enviar tudo e terminar"]');
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
    
    // Se estamos na etapa de confirmação final, lida com o diálogo de confirmação
    if (navigationResult.action === 'finish') {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda o diálogo aparecer
      
      const confirmResult = await browserView.webContents.executeJavaScript(`
        (function() {
          try {
            // Procura pelo botão de confirmação no diálogo
            const confirmButtons = document.querySelectorAll('.confirmation-buttons button');
            
            for (const button of confirmButtons) {
              if (button.textContent.includes('Enviar tudo e terminar')) {
                button.click();
                return { success: true, message: 'Confirmação final enviada' };
              }
            }
            
            // Tenta via evento do moodle (matcher pelo código do botão)
            try {
              require(['core/yui'], function(Y) { 
                Y.one('.confirmation-buttons button').simulate('click');
              });
              return { success: true, message: 'Confirmação final enviada via YUI' };
            } catch (e) {
              console.log('Erro ao usar YUI:', e);
            }
            
            return { success: false, error: 'Botão de confirmação não encontrado' };
          } catch (error) {
            return { success: false, error: error.toString() };
          }
        })();
      `);
      
      if (!confirmResult.success) {
        sendOutput('warning', `Falha na confirmação final: ${confirmResult.error}. Continuando automação...`);
      } else {
        sendOutput('info', confirmResult.message);
      }
    }
    
    return true;
  } catch (error) {
    sendOutput('error', `Erro ao executar script para selecionar resposta/navegar: ${error.message}`);
    return false;
  }
}// Seleciona a resposta e clica no botão próximo ou finaliza o quiz
async function selectAnswerAndNext(correctOption) {
    try {
      // Seleciona a resposta (mantendo o código existente)
      // Se correctOption é um objeto com índice (caso de análise de imagem)
      if (typeof correctOption === 'object' && correctOption.index !== undefined) {
        const selectResult = await browserView.webContents.executeJavaScript(`
          (function() {
            try {
              const optionElements = document.querySelectorAll('${config.optionsSelector}');
              
              // Seleciona pelo índice
              const index = ${correctOption.index};
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
        
        if (!selectResult.success) {
          sendOutput('error', `Falha ao selecionar opção: ${selectResult.error}`);
          return false;
        }
        
        sendOutput('info', `Opção ${correctOption.letter} selecionada com sucesso.`);
      } else {
        // Caso normal com texto da opção
        const selectResult = await browserView.webContents.executeJavaScript(`
          (function() {
            try {
              const optionElements = document.querySelectorAll('${config.optionsSelector}');
              let selected = false;
              
              for (const option of optionElements) {
                let optionText = "";
                
                // Tenta encontrar o texto da opção
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
                
                if (optionText.toLowerCase() === \`${correctOption.toLowerCase().replace(/'/g, "\\'").replace(/"/g, '\\"')}\`) {
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
        
        if (!selectResult.success) {
          sendOutput('error', `Falha ao selecionar opção: ${selectResult.error}`);
          return false;
        }
        
        sendOutput('info', 'Resposta selecionada com sucesso.');
      }
      
      // Pequena pausa após selecionar
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verifica se o botão "Próxima página" existe
      const navigationResult = await browserView.webContents.executeJavaScript(`
        (function() {
          try {
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
                // Se não encontrou o botão de navegação, procura pelo botão "Enviar tudo e terminar"
                const submitButton = document.querySelector('input[value="Enviar tudo e terminar"]');
                
                if (submitButton) {
                  // Se encontrou o botão de finalização
                  submitButton.click();
                  return { success: true, action: 'finish', message: 'Clicado no botão Enviar tudo e terminar' };
                } else {
                  // Verifica se já está na tela de confirmação de envio
                  const confirmDialog = document.querySelector('.confirmation-dialogue');
                  if (confirmDialog) {
                    // Clica no botão de confirmação final
                    const confirmButton = document.querySelector('.confirmation-buttons input[value="Enviar tudo e terminar"]');
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
      
      // Se estamos na etapa de confirmação final, lida com o diálogo de confirmação
      if (navigationResult.action === 'finish') {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda o diálogo aparecer
        
        const confirmResult = await browserView.webContents.executeJavaScript(`
          (function() {
            try {
              // Procura pelo botão de confirmação no diálogo
              const confirmButtons = document.querySelectorAll('.confirmation-buttons button');
              
              for (const button of confirmButtons) {
                if (button.textContent.includes('Enviar tudo e terminar')) {
                  button.click();
                  return { success: true, message: 'Confirmação final enviada' };
                }
              }
              
              // Tenta via evento do moodle (matcher pelo código do botão)
              try {
                require(['core/yui'], function(Y) { 
                  Y.one('.confirmation-buttons button').simulate('click');
                });
                return { success: true, message: 'Confirmação final enviada via YUI' };
              } catch (e) {
                console.log('Erro ao usar YUI:', e);
              }
              
              return { success: false, error: 'Botão de confirmação não encontrado' };
            } catch (error) {
              return { success: false, error: error.toString() };
            }
          })();
        `);
        
        if (!confirmResult.success) {
          sendOutput('warning', `Falha na confirmação final: ${confirmResult.error}. Continuando automação...`);
        } else {
          sendOutput('info', confirmResult.message);
        }
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
  captureScreenshot,
  downloadImageAsBase64,
  analyzeImage: async (imageBase64, prompt) => callGeminiAPI(prompt, imageBase64)
};