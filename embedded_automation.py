#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import logging
import time
import json
import threading
import subprocess
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

class EmbeddedAutomation:
    def __init__(self, url=None, question_selector=".qtext", options_selector="input[type='radio']", next_button_selector="input[value='Próxima página']"):
        self.url = url
        self.question_selector = question_selector
        self.options_selector = options_selector
        self.next_button_selector = next_button_selector
        self.running = True
        self.paused = False
        self.pause_event = threading.Event()
        self.pause_event.set()  # Inicialmente não pausado
        
        # Inicia thread para monitorar entrada padrão para comandos de pausa/continuar
        self.stdin_thread = threading.Thread(target=self._monitor_stdin)
        self.stdin_thread.daemon = True
        self.stdin_thread.start()
    
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
    
    def execute_js_in_embedded_browser(self, js_code):
        """
        Executa código JavaScript no navegador embutido usando o Electron IPC
        Esta função cria um arquivo temporário com o código JS e usa o Electron para executá-lo
        """
        try:
            # Cria um arquivo temporário com o código JavaScript
            js_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'temp_automation.js')
            with open(js_file, 'w', encoding='utf-8') as f:
                f.write(js_code)
            
            logging.info(f"Código JavaScript salvo em {js_file}")
            
            # Notifica o processo principal que deve executar este código
            # Isso é feito escrevendo em um arquivo que o Electron monitora
            command_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'automation_command.json')
            command = {
                "action": "execute_js",
                "file": js_file,
                "timestamp": time.time()
            }
            
            with open(command_file, 'w', encoding='utf-8') as f:
                json.dump(command, f)
            
            logging.info(f"Comando enviado para o Electron: {command}")
            
            # Aguarda o resultado (o Electron irá escrever o resultado em um arquivo)
            result_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'automation_result.json')
            
            # Aguarda até 10 segundos pelo resultado
            start_time = time.time()
            while time.time() - start_time < 10:
                if os.path.exists(result_file):
                    try:
                        with open(result_file, 'r', encoding='utf-8') as f:
                            result = json.load(f)
                        
                        # Verifica se o resultado é para o comando atual
                        if result.get('timestamp') >= command['timestamp']:
                            logging.info(f"Resultado recebido: {result}")
                            
                            # Remove o arquivo de resultado
                            os.remove(result_file)
                            
                            return result.get('data')
                    except Exception as e:
                        logging.error(f"Erro ao ler resultado: {e}")
                
                time.sleep(0.1)
            
            logging.error("Timeout ao aguardar resultado do Electron")
            return None
        
        except Exception as e:
            logging.error(f"Erro ao executar JavaScript no navegador embutido: {e}")
            return None
    
    def navigate_to_url(self):
        """Navega para a URL especificada usando o navegador embutido"""
        if not self.url:
            logging.error("URL não especificada")
            return False
        
        try:
            js_code = f"""
            // Navega para a URL especificada
            try {{
                window.location.href = "{self.url}";
                "Navegação iniciada para {self.url}";
            }} catch (e) {{
                "Erro: " + e.toString();
            }}
            """
            
            result = self.execute_js_in_embedded_browser(js_code)
            logging.info(f"Resultado da navegação: {result}")
            
            # Aguarda um tempo para a página carregar
            time.sleep(5)
            
            return True
        except Exception as e:
            logging.error(f"Erro ao navegar para URL: {e}")
            return False
    
    def process_quiz(self):
        """Processa o quiz, respondendo às perguntas"""
        try:
            # Verifica se a página contém os elementos esperados
            js_check = f"""
            // Verifica se a página contém os elementos esperados
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
            
            check_result = self.execute_js_in_embedded_browser(js_check)
            logging.info(f"Verificação da página: {check_result}")
            
            if isinstance(check_result, dict) and check_result.get('error'):
                logging.error(f"Erro ao verificar página: {check_result['error']}")
                return False
            
            if isinstance(check_result, dict) and check_result.get('questions', 0) == 0:
                logging.error("Nenhuma pergunta encontrada na página")
                return False
            
            # Processa cada pergunta
            js_process = f"""
            // Processa o quiz
            try {{
                const questions = document.querySelectorAll("{self.question_selector}");
                const options = document.querySelectorAll("{self.options_selector}");
                const nextButton = document.querySelector("{self.next_button_selector}");
                
                let results = [];
                
                // Para cada pergunta, seleciona a primeira opção
                for (let i = 0; i < questions.length; i++) {{
                    const questionText = questions[i].textContent.trim();
                    results.push("Pergunta " + (i+1) + ": " + questionText.substring(0, 50) + "...");
                }}
                
                // Seleciona a primeira opção para cada pergunta
                if (options.length > 0) {{
                    options[0].click();
                    results.push("Selecionada primeira opção");
                }}
                
                // Clica no botão de próxima página se existir
                if (nextButton) {{
                    nextButton.click();
                    results.push("Clicado no botão de próxima página");
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
            
            # Aguarda um tempo para a página carregar após clicar no botão
            time.sleep(5)
            
            return True
        
        except Exception as e:
            logging.error(f"Erro ao processar quiz: {e}")
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
            if not self.navigate_to_url():
                return False
            
            # Aguarda um tempo para garantir que a página carregou completamente
            time.sleep(5)
            
            # Processa o quiz
            result = self.process_quiz()
            
            return result
        
        except Exception as e:
            logging.error(f"Erro na execução da automação: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description='Automação de quiz web no navegador embutido')
    parser.add_argument('--url', help='URL do quiz', required=True)
    parser.add_argument('--question-selector', help='Seletor CSS para perguntas', default='.qtext')
    parser.add_argument('--options-selector', help='Seletor CSS para opções', default="input[type='radio']")
    parser.add_argument('--next-button-selector', help='Seletor CSS para botão de próxima página', default="input[value='Próxima página']")
    
    args = parser.parse_args()
    
    automation = EmbeddedAutomation(
        url=args.url,
        question_selector=args.question_selector,
        options_selector=args.options_selector,
        next_button_selector=args.next_button_selector
    )
    
    success = automation.run()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
