#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import logging
import time
import json
import threading
import traceback
import socket
import random
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("automation.log"),
        logging.StreamHandler()
    ]
)

class RobustEmbeddedAutomation:
    def __init__(self, url=None, question_selector=".qtext", options_selector="input[type='radio']", next_button_selector="input[value='Próxima página']"):
        self.url = url
        self.question_selector = question_selector
        self.options_selector = options_selector
        self.next_button_selector = next_button_selector
        self.running = True
        self.paused = False
        self.pause_event = threading.Event()
        self.pause_event.set()  # Inicialmente não pausado
        self.command_id = 0  # ID único para cada comando
        
        # Inicia thread para monitorar entrada padrão para comandos de pausa/continuar
        self.stdin_thread = threading.Thread(target=self._monitor_stdin)
        self.stdin_thread.daemon = True
        self.stdin_thread.start()
        
        # Caminhos para arquivos de comunicação
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.js_file = os.path.join(self.base_dir, 'temp_automation.js')
        self.command_file = os.path.join(self.base_dir, 'automation_command.json')
        self.result_file = os.path.join(self.base_dir, 'automation_result.json')
        
        # Limpa arquivos antigos se existirem
        self._cleanup_files()
    
    def _cleanup_files(self):
        """Limpa arquivos temporários de execuções anteriores"""
        try:
            for file_path in [self.js_file, self.result_file]:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logging.info(f"Arquivo removido: {file_path}")
        except Exception as e:
            logging.warning(f"Erro ao limpar arquivos temporários: {e}")
    
    def _monitor_stdin(self):
        """Monitora a entrada padrão para comandos de pausa/continuar"""
        while self.running:
            try:
                line = sys.stdin.readline().strip()
                if line == "pause":
                    self.pause()
                elif line == "continue":
                    self.resume()
                elif line == "stop":
                    self.stop()
                time.sleep(0.1)
            except Exception as e:
                logging.error(f"Erro ao monitorar stdin: {e}")
    
    def execute_js_in_embedded_browser(self, js_code, timeout=10, retry_count=3):
        """
        Executa código JavaScript no navegador embutido usando o Electron IPC
        Esta função cria um arquivo temporário com o código JS e usa o Electron para executá-lo
        
        Args:
            js_code: Código JavaScript a ser executado
            timeout: Tempo máximo de espera em segundos
            retry_count: Número de tentativas em caso de falha
            
        Returns:
            Resultado da execução do JavaScript ou None em caso de falha
        """
        for attempt in range(retry_count):
            try:
                # Incrementa o ID do comando para garantir unicidade
                self.command_id += 1
                command_id = self.command_id
                
                # Cria um arquivo temporário com o código JavaScript
                with open(self.js_file, 'w', encoding='utf-8') as f:
                    f.write(js_code)
                
                logging.info(f"Código JavaScript salvo em {self.js_file} (tentativa {attempt+1}/{retry_count})")
                
                # Notifica o processo principal que deve executar este código
                command = {
                    "action": "execute_js",
                    "file": self.js_file,
                    "timestamp": time.time(),
                    "id": command_id
                }
                
                with open(self.command_file, 'w', encoding='utf-8') as f:
                    json.dump(command, f)
                
                logging.info(f"Comando enviado para o Electron: ID={command_id}")
                
                # Aguarda o resultado
                start_time = time.time()
                while time.time() - start_time < timeout:
                    if os.path.exists(self.result_file):
                        try:
                            with open(self.result_file, 'r', encoding='utf-8') as f:
                                result = json.load(f)
                            
                            # Verifica se o resultado é para o comando atual
                            if result.get('timestamp') >= command['timestamp']:
                                logging.info(f"Resultado recebido para comando ID={command_id}")
                                
                                if not result.get('success'):
                                    logging.warning(f"Erro na execução do JavaScript: {result.get('error')}")
                                    # Se for erro de JavaScript, não faz sentido tentar novamente da mesma forma
                                    if "SyntaxError" in str(result.get('error', '')):
                                        return None
                                    # Continua para a próxima tentativa
                                    break
                                
                                return result.get('data')
                        except Exception as e:
                            logging.error(f"Erro ao ler resultado: {e}")
                    
                    # Pausa curta para não sobrecarregar a CPU
                    time.sleep(0.1)
                
                logging.warning(f"Timeout ao aguardar resultado do Electron (tentativa {attempt+1}/{retry_count})")
                
                # Força a abertura do DevTools para garantir que a depuração remota esteja ativa
                if attempt == 0:
                    self._force_open_devtools()
                    time.sleep(1)  # Aguarda um pouco antes da próxima tentativa
            
            except Exception as e:
                logging.error(f"Erro ao executar JavaScript (tentativa {attempt+1}/{retry_count}): {e}")
                logging.error(traceback.format_exc())
        
        logging.error(f"Falha após {retry_count} tentativas de executar JavaScript")
        return None
    
    def _force_open_devtools(self):
        """Força a abertura do DevTools para garantir que a depuração remota esteja ativa"""
        try:
            command = {
                "action": "open_devtools",
                "timestamp": time.time()
            }
            
            with open(self.command_file, 'w', encoding='utf-8') as f:
                json.dump(command, f)
            
            logging.info("Comando para abrir DevTools enviado")
        except Exception as e:
            logging.error(f"Erro ao tentar abrir DevTools: {e}")
    
    def get_current_url(self):
        """Obtém a URL atual do navegador embutido"""
        js_code = """
        try {
            return window.location.href;
        } catch (e) {
            return "Erro: " + e.toString();
        }
        """
        
        result = self.execute_js_in_embedded_browser(js_code)
        if isinstance(result, str) and result.startswith("Erro:"):
            logging.error(f"Erro ao obter URL atual: {result}")
            return None
        
        return result
    
    def navigate_to_url(self):
        """Navega para a URL especificada usando o navegador embutido"""
        if not self.url:
            logging.error("URL não especificada")
            return False
        
        try:
            # Primeiro verifica a URL atual
            current_url = self.get_current_url()
            logging.info(f"URL atual: {current_url}")
            
            # Se já estiver na URL desejada, não precisa navegar
            if current_url == self.url:
                logging.info(f"Já está na URL desejada: {self.url}")
                return True
            
            # Navega para a URL especificada
            js_code = f"""
            try {{
                console.log("Navegando para: {self.url}");
                window.location.href = "{self.url}";
                return "Navegação iniciada para {self.url}";
            }} catch (e) {{
                return "Erro: " + e.toString();
            }}
            """
            
            result = self.execute_js_in_embedded_browser(js_code)
            logging.info(f"Resultado da navegação: {result}")
            
            # Aguarda um tempo para a página carregar
            time.sleep(5)
            
            # Verifica se a navegação foi bem-sucedida
            new_url = self.get_current_url()
            logging.info(f"Nova URL após navegação: {new_url}")
            
            if new_url and (new_url == self.url or self.url in new_url):
                logging.info("Navegação bem-sucedida")
                return True
            else:
                logging.warning(f"URL após navegação ({new_url}) não corresponde à URL desejada ({self.url})")
                return False
        
        except Exception as e:
            logging.error(f"Erro ao navegar para URL: {e}")
            logging.error(traceback.format_exc())
            return False
    
    def check_page_elements(self):
        """Verifica se a página contém os elementos esperados"""
        # Usa seletores mais genéricos para aumentar a chance de encontrar elementos
        js_check = """
        try {
            // Tenta múltiplos seletores para perguntas
            const questionSelectors = [
                ".qtext", 
                ".que .content", 
                ".que", 
                ".formulation", 
                "div[id^='question']",
                ".question-text",
                "form .content"
            ];
            
            // Tenta múltiplos seletores para opções
            const optionSelectors = [
                "input[type='radio']", 
                "input[type='checkbox']", 
                ".answer input", 
                ".option input", 
                "label.answeroption input",
                ".answer",
                ".option"
            ];
            
            // Tenta múltiplos seletores para botões de próxima página
            const nextButtonSelectors = [
                "input[value='Próxima página']", 
                "input[value='Next page']", 
                "button.submitbtns", 
                ".submitbtns input[type='submit']", 
                "input[name='next']", 
                ".mod_quiz-next-nav",
                "button[type='submit']",
                ".nextpage"
            ];
            
            let questions = [];
            let options = [];
            let nextButtons = [];
            
            // Tenta cada seletor para perguntas
            for (const selector of questionSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    questions = elements;
                    break;
                }
            }
            
            // Tenta cada seletor para opções
            for (const selector of optionSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    options = elements;
                    break;
                }
            }
            
            // Tenta cada seletor para botões de próxima página
            for (const selector of nextButtonSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    nextButtons = elements;
                    break;
                }
            }
            
            // Retorna informações sobre os elementos encontrados
            return {
                "questions": {
                    "count": questions.length,
                    "texts": Array.from(questions).slice(0, 3).map(q => q.textContent.trim().substring(0, 50))
                },
                "options": {
                    "count": options.length,
                    "types": Array.from(options).slice(0, 3).map(o => o.tagName + (o.type ? ":" + o.type : ""))
                },
                "nextButtons": {
                    "count": nextButtons.length,
                    "texts": Array.from(nextButtons).slice(0, 3).map(b => b.value || b.textContent.trim().substring(0, 20))
                },
                "pageTitle": document.title,
                "bodyText": document.body.textContent.substring(0, 100)
            };
        } catch (e) {
            return {"error": e.toString()};
        }
        """
        
        check_result = self.execute_js_in_embedded_browser(js_check)
        logging.info(f"Verificação da página: {check_result}")
        
        if isinstance(check_result, dict) and check_result.get('error'):
            logging.error(f"Erro ao verificar página: {check_result['error']}")
            return False
        
        # Verifica se encontrou algum elemento
        if isinstance(check_result, dict):
            questions_count = check_result.get('questions', {}).get('count', 0)
            options_count = check_result.get('options', {}).get('count', 0)
            next_buttons_count = check_result.get('nextButtons', {}).get('count', 0)
            
            if questions_count > 0 or options_count > 0 or next_buttons_count > 0:
                logging.info(f"Elementos encontrados: {questions_count} perguntas, {options_count} opções, {next_buttons_count} botões")
                return True
            else:
                logging.warning("Nenhum elemento relevante encontrado na página")
                return False
        
        logging.warning("Resultado da verificação da página não é um dicionário válido")
        return False
    
    def process_quiz(self, max_questions=10):
        """
        Processa o quiz, respondendo às perguntas
        
        Args:
            max_questions: Número máximo de perguntas a processar
            
        Returns:
            True se o processamento foi bem-sucedido, False caso contrário
        """
        questions_processed = 0
        
        try:
            # Primeiro verifica se a página contém os elementos esperados
            if not self.check_page_elements():
                logging.warning("Verificação inicial da página falhou, tentando com seletores específicos")
                
                # Tenta verificar com os seletores específicos fornecidos
                js_specific_check = f"""
                try {{
                    const questions = document.querySelectorAll("{self.question_selector}");
                    const options = document.querySelectorAll("{self.options_selector}");
                    const nextButton = document.querySelector("{self.next_button_selector}");
                    
                    return {{
                        "questions": questions.length,
                        "options": options.length,
                        "hasNextButton": nextButton !== null
                    }};
                }} catch (e) {{
                    return {{"error": e.toString()}};
                }}
                """
                
                specific_check_result = self.execute_js_in_embedded_browser(js_specific_check)
                logging.info(f"Verificação com seletores específicos: {specific_check_result}")
                
                if isinstance(specific_check_result, dict) and specific_check_result.get('error'):
                    logging.error(f"Erro ao verificar página com seletores específicos: {specific_check_result['error']}")
                    return False
                
                if isinstance(specific_check_result, dict) and specific_check_result.get('questions', 0) == 0:
                    logging.error("Nenhuma pergunta encontrada na página com seletores específicos")
                    return False
            
            # Loop para processar múltiplas perguntas
            while self.running and questions_processed < max_questions:
                # Verifica se está pausado
                self.pause_event.wait()
                
                # Processa a pergunta atual
                js_process = f"""
                try {{
                    // Tenta encontrar elementos com os seletores fornecidos
                    let questions = document.querySelectorAll("{self.question_selector}");
                    let options = document.querySelectorAll("{self.options_selector}");
                    let nextButton = document.querySelector("{self.next_button_selector}");
                    
                    // Se não encontrar com os seletores fornecidos, tenta seletores alternativos
                    if (questions.length === 0) {{
                        const altQuestionSelectors = [".qtext", ".que .content", ".question-text", "form .content"];
                        for (const selector of altQuestionSelectors) {{
                            questions = document.querySelectorAll(selector);
                            if (questions.length > 0) break;
                        }}
                    }}
                    
                    if (options.length === 0) {{
                        const altOptionSelectors = ["input[type='radio']", "input[type='checkbox']", ".answer input"];
                        for (const selector of altOptionSelectors) {{
                            options = document.querySelectorAll(selector);
                            if (options.length > 0) break;
                        }}
                    }}
                    
                    if (!nextButton) {{
                        const altNextButtonSelectors = [
                            "input[value='Próxima página']", 
                            "input[value='Next page']", 
                            "button.submitbtns", 
                            ".submitbtns input[type='submit']"
                        ];
                        for (const selector of altNextButtonSelectors) {{
                            nextButton = document.querySelector(selector);
                            if (nextButton) break;
                        }}
                    }}
                    
                    let results = [];
                    
                    // Informações sobre a pergunta atual
                    if (questions.length > 0) {{
                        const questionText = questions[0].textContent.trim();
                        results.push("Pergunta encontrada: " + questionText.substring(0, 50) + "...");
                    }} else {{
                        results.push("Nenhuma pergunta encontrada");
                    }}
                    
                    // Seleciona uma opção
                    if (options.length > 0) {{
                        // Seleciona a primeira opção
                        try {{
                            options[0].click();
                            results.push("Opção selecionada: " + (options[0].value || "primeira opção"));
                        }} catch (clickError) {{
                            // Se não conseguir clicar diretamente, tenta outras abordagens
                            if (options[0].type === 'radio' || options[0].type === 'checkbox') {{
                                options[0].checked = true;
                                results.push("Opção marcada via propriedade checked");
                                
                                // Dispara evento de mudança para garantir que o JavaScript da página reconheça a seleção
                                const event = new Event('change', {{ bubbles: true }});
                                options[0].dispatchEvent(event);
                            }}
                        }}
                    }} else {{
                        results.push("Nenhuma opção encontrada");
                    }}
                    
                    // Clica no botão de próxima página
                    if (nextButton) {{
                        try {{
                            nextButton.click();
                            results.push("Botão de próxima página clicado");
                        }} catch (clickError) {{
                            // Se não conseguir clicar diretamente, tenta outras abordagens
                            results.push("Erro ao clicar no botão: " + clickError.toString());
                            
                            // Tenta submeter o formulário diretamente
                            const form = nextButton.closest('form');
                            if (form) {{
                                try {{
                                    form.submit();
                                    results.push("Formulário submetido diretamente");
                                }} catch (submitError) {{
                                    results.push("Erro ao submeter formulário: " + submitError.toString());
                                }}
                            }}
                        }}
                    }} else {{
                        results.push("Botão de próxima página não encontrado");
                    }}
                    
                    return results;
                }} catch (e) {{
                    return ["Erro: " + e.toString()];
                }}
                """
                
                process_result = self.execute_js_in_embedded_browser(js_process)
                logging.info(f"Resultado do processamento: {process_result}")
                
                # Verifica se houve erro no processamento
                if isinstance(process_result, list) and len(process_result) > 0 and isinstance(process_result[0], str) and process_result[0].startswith("Erro:"):
                    logging.error(f"Erro ao processar pergunta: {process_result[0]}")
                    return False
                
                # Incrementa o contador de perguntas processadas
                questions_processed += 1
                
                # Aguarda um tempo para a página carregar após clicar no botão
                time.sleep(5)
                
                # Verifica se ainda há perguntas para processar
                if not self.check_page_elements():
                    logging.info("Não há mais perguntas para processar")
                    break
            
            logging.info(f"Processamento concluído. {questions_processed} perguntas processadas.")
            return True
        
        except Exception as e:
            logging.error(f"Erro ao processar quiz: {e}")
            logging.error(traceback.format_exc())
            return False
    
    def pause(self):
        """Pausa a automação"""
        if not self.paused:
            logging.info("Automação pausada")
            self.paused = True
            self.pause_event.clear()
    
    def resume(self):
        """Retoma a automação"""
        if self.paused:
            logging.info("Automação retomada")
            self.paused = False
            self.pause_event.set()
    
    def stop(self):
        """Para a automação"""
        logging.info("Parando automação")
        self.running = False
        self.pause_event.set()  # Garante que não fique bloqueado
    
    def run(self):
        """Executa a automação completa"""
        try:
            # Verifica se o navegador embutido está funcionando
            current_url = self.get_current_url()
            if not current_url:
                logging.error("Não foi possível obter a URL atual. O navegador embutido está funcionando?")
                return False
            
            logging.info(f"Navegador embutido está em: {current_url}")
            
            # Navega para a URL especificada (se fornecida)
            if self.url:
                if not self.navigate_to_url():
                    logging.error(f"Falha ao navegar para {self.url}")
                    return False
                
                # Aguarda um tempo para garantir que a página carregou completamente
                time.sleep(5)
            
            # Processa o quiz
            result = self.process_quiz()
            
            # Limpa arquivos temporários
            self._cleanup_files()
            
            return result
        
        except Exception as e:
            logging.error(f"Erro na execução da automação: {e}")
            logging.error(traceback.format_exc())
            return False

def main():
    parser = argparse.ArgumentParser(description='Automação robusta de quiz web no navegador embutido')
    parser.add_argument('--url', help='URL do quiz (opcional se já estiver na página correta)')
    parser.add_argument('--question-selector', help='Seletor CSS para perguntas', default='.qtext')
    parser.add_argument('--options-selector', help='Seletor CSS para opções', default="input[type='radio']")
    parser.add_argument('--next-button-selector', help='Seletor CSS para botão de próxima página', default="input[value='Próxima página']")
    
    args = parser.parse_args()
    
    # Exibe informações sobre a execução
    logging.info("=== Iniciando Automação Robusta no Navegador Embutido ===")
    logging.info(f"URL: {args.url if args.url else 'Usar URL atual'}")
    logging.info(f"Seletor de perguntas: {args.question_selector}")
    logging.info(f"Seletor de opções: {args.options_selector}")
    logging.info(f"Seletor de botão próxima: {args.next_button_selector}")
    
    # Cria e executa a automação
    automation = RobustEmbeddedAutomation(
        url=args.url,
        question_selector=args.question_selector,
        options_selector=args.options_selector,
        next_button_selector=args.next_button_selector
    )
    
    success = automation.run()
    
    if success:
        logging.info("=== Automação concluída com sucesso ===")
    else:
        logging.error("=== Automação falhou ===")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
