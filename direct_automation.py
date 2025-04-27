#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import logging
import time
import json
import threading
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

class DirectAutomation:
    def __init__(self, url=None, question_selector=".qtext", options_selector="input[type='radio']", next_button_selector="input[value='Próxima página']"):
        self.url = url
        self.question_selector = question_selector
        self.options_selector = options_selector
        self.next_button_selector = next_button_selector
        self.driver = None
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
    
    def setup_driver(self):
        """Configura um novo driver do Chrome para automação"""
        try:
            # Configurações do Chrome
            chrome_options = Options()
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--disable-extensions")
            chrome_options.add_argument("--disable-notifications")
            chrome_options.add_argument("--disable-infobars")
            chrome_options.add_argument("--mute-audio")
            
            # Inicializa o driver
            try:
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
                logging.info("Driver do Chrome inicializado com sucesso")
            except Exception as e:
                logging.warning(f"Falha ao usar ChromeDriverManager: {e}")
                # Fallback para inicialização direta
                try:
                    self.driver = webdriver.Chrome(options=chrome_options)
                    logging.info("Driver do Chrome inicializado com fallback")
                except Exception as direct_error:
                    logging.error(f"Falha também no método direto: {direct_error}")
                    raise Exception("Não foi possível inicializar o driver do Chrome por nenhum método")
            
            # Configura timeouts
            self.driver.set_page_load_timeout(60)
            self.driver.implicitly_wait(30)
            
            return True
        except Exception as e:
            logging.error(f"Erro ao configurar o driver: {e}")
            logging.error("Detalhes do erro:")
            import traceback
            logging.error(traceback.format_exc())
            
            # Instruções para o usuário
            logging.error("\n" + "="*80)
            logging.error("INSTRUÇÕES PARA RESOLVER O PROBLEMA:")
            logging.error("1. Verifique se o Chrome está instalado corretamente")
            logging.error("2. Instale as dependências necessárias:")
            logging.error("   pip install webdriver-manager selenium --upgrade")
            logging.error("3. Verifique se não há outras instâncias do Chrome em execução")
            logging.error("="*80)
            return False
    
    def navigate_to_url(self):
        """Navega para a URL especificada"""
        if not self.url:
            logging.error("URL não especificada")
            return False
        
        try:
            logging.info(f"Navegando para: {self.url}")
            self.driver.get(self.url)
            
            # Aguarda carregamento da página (até 30 segundos)
            WebDriverWait(self.driver, 30).until(
                lambda d: d.execute_script('return document.readyState') == 'complete'
            )
            
            return True
        except Exception as e:
            logging.error(f"Erro ao navegar para URL: {e}")
            return False
    
    def process_quiz(self):
        """Processa o quiz, respondendo às perguntas"""
        try:
            # Aguarda elementos da página
            try:
                WebDriverWait(self.driver, 30).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, self.question_selector))
                )
            except TimeoutException:
                logging.error("Timeout ao aguardar elementos da página")
                return False
            
            # Processa cada pergunta
            while True:
                # Pausa se necessário
                self.pause_event.wait()
                if not self.running:
                    break
                
                # Encontra a pergunta atual
                try:
                    questions = self.driver.find_elements(By.CSS_SELECTOR, self.question_selector)
                    if not questions:
                        logging.info("Nenhuma pergunta encontrada. Quiz pode ter terminado.")
                        break
                    
                    for question_idx, question in enumerate(questions):
                        logging.info(f"Processando pergunta {question_idx+1}: {question.text[:50]}...")
                        
                        # Encontra as opções para esta pergunta
                        options = self.driver.find_elements(By.CSS_SELECTOR, self.options_selector)
                        if not options:
                            logging.warning(f"Nenhuma opção encontrada para a pergunta {question_idx+1}")
                            continue
                        
                        # Seleciona a primeira opção (ou poderia implementar lógica mais complexa aqui)
                        try:
                            options[0].click()
                            logging.info(f"Selecionada primeira opção para pergunta {question_idx+1}")
                        except Exception as e:
                            logging.error(f"Erro ao selecionar opção: {e}")
                    
                    # Clica no botão de próxima página
                    try:
                        next_button = self.driver.find_element(By.CSS_SELECTOR, self.next_button_selector)
                        next_button.click()
                        logging.info("Clicado no botão de próxima página")
                        
                        # Aguarda carregamento da próxima página
                        time.sleep(2)
                        WebDriverWait(self.driver, 30).until(
                            lambda d: d.execute_script('return document.readyState') == 'complete'
                        )
                    except NoSuchElementException:
                        logging.info("Botão de próxima página não encontrado. Quiz pode ter terminado.")
                        break
                    except Exception as e:
                        logging.error(f"Erro ao clicar no botão de próxima página: {e}")
                        break
                
                except Exception as e:
                    logging.error(f"Erro ao processar perguntas: {e}")
                    break
            
            logging.info("Processamento do quiz concluído")
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
    
    def close(self):
        """Fecha o driver e libera recursos"""
        if self.driver:
            try:
                self.driver.quit()
                logging.info("Driver do Chrome fechado")
            except Exception as e:
                logging.error(f"Erro ao fechar driver: {e}")
        
        self.running = False
    
    def run(self):
        """Executa a automação completa"""
        try:
            if not self.setup_driver():
                return False
            
            if not self.navigate_to_url():
                self.close()
                return False
            
            result = self.process_quiz()
            
            # Mantém o navegador aberto por um tempo para visualização
            time.sleep(5)
            
            self.close()
            return result
        
        except Exception as e:
            logging.error(f"Erro na execução da automação: {e}")
            self.close()
            return False

def main():
    parser = argparse.ArgumentParser(description='Automação de quiz web')
    parser.add_argument('--url', help='URL do quiz', required=True)
    parser.add_argument('--question-selector', help='Seletor CSS para perguntas', default='.qtext')
    parser.add_argument('--options-selector', help='Seletor CSS para opções', default="input[type='radio']")
    parser.add_argument('--next-button-selector', help='Seletor CSS para botão de próxima página', default="input[value='Próxima página']")
    
    args = parser.parse_args()
    
    automation = DirectAutomation(
        url=args.url,
        question_selector=args.question_selector,
        options_selector=args.options_selector,
        next_button_selector=args.next_button_selector
    )
    
    success = automation.run()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
