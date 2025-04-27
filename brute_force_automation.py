#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import logging
import time
import json
import subprocess
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

class BruteForceAutomation:
    def __init__(self, url=None):
        self.url = url
        self.driver = None
    
    def setup_driver(self):
        """Configura o driver do Chrome para automação"""
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
            
            # Tenta usar o navegador embutido via porta de depuração
            try:
                # Lê a porta de depuração do arquivo
                debug_port = 9222  # Porta padrão
                debug_port_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'debug_port.txt')
                if os.path.exists(debug_port_file):
                    with open(debug_port_file, 'r') as f:
                        debug_port = int(f.read().strip())
                    logging.info(f"Porta de depuração lida do arquivo: {debug_port}")
                
                # Tenta conectar ao navegador embutido
                chrome_options.add_experimental_option("debuggerAddress", f"127.0.0.1:{debug_port}")
                
                # Tenta inicializar o driver com ChromeDriverManager
                try:
                    service = Service(ChromeDriverManager().install())
                    self.driver = webdriver.Chrome(service=service, options=chrome_options)
                    logging.info("Driver do Chrome inicializado com sucesso via debuggerAddress")
                    return True
                except Exception as e:
                    logging.warning(f"Falha ao usar ChromeDriverManager com debuggerAddress: {e}")
                    
                    # Tenta inicialização direta
                    try:
                        self.driver = webdriver.Chrome(options=chrome_options)
                        logging.info("Driver do Chrome inicializado com fallback direto via debuggerAddress")
                        return True
                    except Exception as direct_error:
                        logging.error(f"Falha também no método direto com debuggerAddress: {direct_error}")
            
            except Exception as debug_error:
                logging.warning(f"Falha ao conectar via debuggerAddress: {debug_error}")
            
            # Se falhar a conexão via debuggerAddress, tenta abrir uma nova instância
            logging.info("Tentando abrir uma nova instância do Chrome como fallback")
            chrome_options = Options()  # Reset das opções
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            
            # Tenta inicializar o driver com ChromeDriverManager
            try:
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
                logging.info("Driver do Chrome inicializado com sucesso (nova instância)")
                return True
            except Exception as e:
                logging.warning(f"Falha ao usar ChromeDriverManager (nova instância): {e}")
                
                # Tenta inicialização direta
                try:
                    self.driver = webdriver.Chrome(options=chrome_options)
                    logging.info("Driver do Chrome inicializado com fallback direto (nova instância)")
                    return True
                except Exception as direct_error:
                    logging.error(f"Falha também no método direto (nova instância): {direct_error}")
            
            # Se todas as tentativas falharem
            raise Exception("Não foi possível inicializar o driver do Chrome por nenhum método")
            
        except Exception as e:
            logging.error(f"Erro ao configurar o driver: {e}")
            logging.error("Detalhes do erro:")
            import traceback
            logging.error(traceback.format_exc())
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
            # Tenta diferentes seletores para encontrar perguntas
            question_selectors = [
                ".qtext",
                ".que .content",
                ".que",
                ".formulation",
                "div[id^='question']"
            ]
            
            # Tenta diferentes seletores para encontrar opções
            option_selectors = [
                "input[type='radio']",
                "input[type='checkbox']",
                ".answer input",
                ".option input",
                "label.answeroption input"
            ]
            
            # Tenta diferentes seletores para o botão de próxima página
            next_button_selectors = [
                "input[value='Próxima página']",
                "input[value='Next page']",
                "button.submitbtns",
                ".submitbtns input[type='submit']",
                "input[name='next']",
                ".mod_quiz-next-nav"
            ]
            
            # Tenta encontrar perguntas com diferentes seletores
            questions = None
            question_selector_used = None
            for selector in question_selectors:
                try:
                    questions = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if questions and len(questions) > 0:
                        logging.info(f"Perguntas encontradas com seletor: {selector}")
                        question_selector_used = selector
                        break
                except Exception:
                    continue
            
            if not questions or len(questions) == 0:
                logging.error("Nenhuma pergunta encontrada com os seletores disponíveis")
                
                # Tenta usar JavaScript para encontrar elementos de texto que possam ser perguntas
                try:
                    js_result = self.driver.execute_script("""
                        const possibleQuestions = [];
                        const allElements = document.querySelectorAll('div, p, span, h1, h2, h3, h4, h5, h6');
                        for (const el of allElements) {
                            if (el.textContent && el.textContent.length > 20 && el.textContent.length < 500) {
                                possibleQuestions.push(el);
                            }
                        }
                        return possibleQuestions.length;
                    """)
                    logging.info(f"Possíveis perguntas encontradas via JavaScript: {js_result}")
                except Exception as js_error:
                    logging.error(f"Erro ao executar JavaScript para encontrar perguntas: {js_error}")
                
                # Continua mesmo sem encontrar perguntas
            
            # Tenta encontrar opções com diferentes seletores
            options = None
            option_selector_used = None
            for selector in option_selectors:
                try:
                    options = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if options and len(options) > 0:
                        logging.info(f"Opções encontradas com seletor: {selector}")
                        option_selector_used = selector
                        break
                except Exception:
                    continue
            
            if not options or len(options) == 0:
                logging.warning("Nenhuma opção encontrada com os seletores disponíveis")
                
                # Tenta usar JavaScript para encontrar elementos de input que possam ser opções
                try:
                    js_result = self.driver.execute_script("""
                        const allInputs = document.querySelectorAll('input');
                        let count = 0;
                        for (const input of allInputs) {
                            if (input.type === 'radio' || input.type === 'checkbox') {
                                count++;
                            }
                        }
                        return count;
                    """)
                    logging.info(f"Possíveis opções encontradas via JavaScript: {js_result}")
                except Exception as js_error:
                    logging.error(f"Erro ao executar JavaScript para encontrar opções: {js_error}")
            
            # Se encontrou opções, seleciona aleatoriamente
            if options and len(options) > 0:
                # Seleciona uma opção aleatória para cada pergunta
                try:
                    # Agrupa as opções por pergunta (assumindo que estão em ordem)
                    options_per_question = {}
                    
                    # Se temos perguntas identificadas, tenta agrupar as opções
                    if questions and len(questions) > 0:
                        # Tenta determinar quais opções pertencem a cada pergunta
                        for i, question in enumerate(questions):
                            options_per_question[i] = []
                            
                            # Tenta encontrar opções dentro ou próximas à pergunta
                            try:
                                question_options = question.find_elements(By.CSS_SELECTOR, option_selector_used)
                                if question_options and len(question_options) > 0:
                                    options_per_question[i] = question_options
                            except Exception:
                                pass
                        
                        # Se não conseguiu agrupar, distribui as opções igualmente
                        empty_groups = sum(1 for opts in options_per_question.values() if len(opts) == 0)
                        if empty_groups == len(questions):
                            options_per_question = {}
                            options_per_group = len(options) // len(questions)
                            for i in range(len(questions)):
                                start_idx = i * options_per_group
                                end_idx = start_idx + options_per_group
                                if i == len(questions) - 1:
                                    end_idx = len(options)
                                options_per_question[i] = options[start_idx:end_idx]
                    else:
                        # Se não temos perguntas identificadas, coloca todas as opções em um grupo
                        options_per_question[0] = options
                    
                    # Seleciona uma opção aleatória para cada grupo
                    for question_idx, question_options in options_per_question.items():
                        if question_options and len(question_options) > 0:
                            # Seleciona uma opção aleatória
                            random_option = random.choice(question_options)
                            try:
                                random_option.click()
                                logging.info(f"Selecionada opção aleatória para pergunta {question_idx+1}")
                            except Exception as click_error:
                                logging.error(f"Erro ao clicar na opção: {click_error}")
                                
                                # Tenta clicar via JavaScript
                                try:
                                    self.driver.execute_script("arguments[0].click();", random_option)
                                    logging.info(f"Selecionada opção via JavaScript para pergunta {question_idx+1}")
                                except Exception as js_click_error:
                                    logging.error(f"Erro ao clicar via JavaScript: {js_click_error}")
                
                except Exception as selection_error:
                    logging.error(f"Erro ao selecionar opções: {selection_error}")
                    
                    # Abordagem bruta: tenta clicar em todas as opções
                    try:
                        for i, option in enumerate(options):
                            try:
                                option.click()
                                logging.info(f"Clicado na opção {i+1}")
                            except Exception:
                                try:
                                    self.driver.execute_script("arguments[0].click();", option)
                                    logging.info(f"Clicado na opção {i+1} via JavaScript")
                                except Exception:
                                    pass
                    except Exception as brute_error:
                        logging.error(f"Erro na abordagem bruta: {brute_error}")
            
            # Tenta encontrar o botão de próxima página com diferentes seletores
            next_button = None
            for selector in next_button_selectors:
                try:
                    buttons = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if buttons and len(buttons) > 0:
                        next_button = buttons[0]
                        logging.info(f"Botão de próxima página encontrado com seletor: {selector}")
                        break
                except Exception:
                    continue
            
            # Se encontrou o botão de próxima página, clica nele
            if next_button:
                try:
                    next_button.click()
                    logging.info("Clicado no botão de próxima página")
                except Exception as click_error:
                    logging.error(f"Erro ao clicar no botão de próxima página: {click_error}")
                    
                    # Tenta clicar via JavaScript
                    try:
                        self.driver.execute_script("arguments[0].click();", next_button)
                        logging.info("Clicado no botão de próxima página via JavaScript")
                    except Exception as js_click_error:
                        logging.error(f"Erro ao clicar via JavaScript: {js_click_error}")
            else:
                logging.warning("Botão de próxima página não encontrado")
                
                # Tenta encontrar qualquer botão ou link que possa ser o próximo
                try:
                    # Procura por botões com texto relacionado a "próximo", "next", "continuar", etc.
                    buttons = self.driver.find_elements(By.CSS_SELECTOR, "button, input[type='submit'], a.btn")
                    for button in buttons:
                        try:
                            button_text = button.text.lower() if button.text else ""
                            button_value = button.get_attribute("value").lower() if button.get_attribute("value") else ""
                            if any(keyword in button_text or keyword in button_value for keyword in ["próx", "next", "cont", "submit", "enviar"]):
                                button.click()
                                logging.info(f"Clicado em botão alternativo: {button_text or button_value}")
                                break
                        except Exception:
                            continue
                except Exception as alt_button_error:
                    logging.error(f"Erro ao procurar botões alternativos: {alt_button_error}")
            
            # Aguarda um tempo para a página carregar após clicar no botão
            time.sleep(5)
            
            return True
        
        except Exception as e:
            logging.error(f"Erro ao processar quiz: {e}")
            return False
    
    def close(self):
        """Fecha o driver e libera recursos"""
        if self.driver:
            try:
                # Não fecha o navegador se estiver usando debuggerAddress
                if "--debuggerAddress" not in str(self.driver.capabilities):
                    self.driver.quit()
                    logging.info("Driver do Chrome fechado")
                else:
                    logging.info("Mantendo navegador embutido aberto (usando debuggerAddress)")
            except Exception as e:
                logging.error(f"Erro ao fechar driver: {e}")
    
    def run(self):
        """Executa a automação completa"""
        try:
            if not self.setup_driver():
                return False
            
            if not self.navigate_to_url():
                self.close()
                return False
            
            result = self.process_quiz()
            
            self.close()
            return result
        
        except Exception as e:
            logging.error(f"Erro na execução da automação: {e}")
            self.close()
            return False

def main():
    parser = argparse.ArgumentParser(description='Automação de quiz web')
    parser.add_argument('--url', help='URL do quiz', required=True)
    
    args = parser.parse_args()
    
    automation = BruteForceAutomation(url=args.url)
    
    success = automation.run()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
