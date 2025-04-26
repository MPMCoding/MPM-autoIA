import os
import sys
import argparse
import logging
import time
import json
import threading
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("automation.log"),
        logging.StreamHandler()
    ]
)

class WebQuizAutomation:
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
        """Configura o driver do Chrome para a automação"""
        try:
            chrome_options = Options()
            
            # Configurações para modo embutido (sem abrir nova janela)
            chrome_options.add_argument("--headless")  # Modo headless para não mostrar interface
            
            # Inicializa o driver
            self.driver = webdriver.Chrome(options=chrome_options)
            logging.info(f"Driver do Chrome inicializado com sucesso")
            
            return True
        except Exception as e:
            logging.error(f"Erro ao configurar o driver: {e}")
            return False
    
    def navigate_to_url(self):
        """Navega para a URL especificada"""
        if not self.url:
            logging.error("URL não especificada")
            return False
        
        try:
            logging.info(f"Navegando para: {self.url}")
            self.driver.get(self.url)
            return True
        except Exception as e:
            logging.error(f"Erro ao navegar para a URL: {e}")
            return False
    
    def process_quiz(self):
        """Processa o quiz automaticamente"""
        try:
            # Aguarda a página carregar
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, self.question_selector))
            )
            
            while self.running:
                # Verifica se está pausado
                self.pause_event.wait()
                
                # Encontra a pergunta atual
                try:
                    question_element = self.driver.find_element(By.CSS_SELECTOR, self.question_selector)
                    question_text = question_element.text.strip()
                    logging.info(f"Pergunta encontrada: {question_text}")
                    
                    # Encontra as opções
                    options = self.driver.find_elements(By.CSS_SELECTOR, self.options_selector)
                    
                    if options:
                        # Seleciona a primeira opção (pode ser modificado para usar IA para escolher a melhor opção)
                        options[0].click()
                        logging.info(f"Selecionou a primeira opção")
                        
                        # Aguarda um pouco para simular comportamento humano
                        time.sleep(1)
                        
                        # Clica no botão de próxima
                        try:
                            next_button = self.driver.find_element(By.CSS_SELECTOR, self.next_button_selector)
                            next_button.click()
                            logging.info("Clicou no botão de próxima página")
                            
                            # Aguarda a próxima pergunta carregar
                            time.sleep(2)
                        except NoSuchElementException:
                            logging.info("Botão de próxima página não encontrado. Pode ser a última pergunta.")
                            break
                    else:
                        logging.warning("Nenhuma opção encontrada para a pergunta atual")
                        break
                except NoSuchElementException:
                    logging.info("Nenhuma pergunta encontrada. Quiz pode ter terminado.")
                    break
                except Exception as e:
                    logging.error(f"Erro ao processar pergunta: {e}")
                    break
            
            logging.info("Processamento do quiz concluído")
            return True
        except TimeoutException:
            logging.error("Timeout ao aguardar elementos da página")
            return False
        except Exception as e:
            logging.error(f"Erro ao processar o quiz: {e}")
            return False
    
    def run(self):
        """Executa a automação completa"""
        try:
            if not self.setup_driver():
                return False
            
            if not self.navigate_to_url():
                self.cleanup()
                return False
            
            result = self.process_quiz()
            self.cleanup()
            return result
        except Exception as e:
            logging.error(f"Erro na execução da automação: {e}")
            self.cleanup()
            return False
    
    def cleanup(self):
        """Limpa recursos e fecha o driver"""
        try:
            if self.driver:
                self.driver.quit()
                logging.info("Driver do Chrome fechado")
        except Exception as e:
            logging.error(f"Erro ao fechar o driver: {e}")
    
    def stop(self):
        """Para a automação"""
        logging.info("Parando automação")
        self.running = False
        self.pause_event.set()  # Garante que não está pausado para poder encerrar
        self.cleanup()
    
    def pause(self):
        """Pausa a automação"""
        if not self.paused:
            logging.info("Pausando automação")
            self.paused = True
            self.pause_event.clear()
    
    def resume(self):
        """Continua a automação após pausa"""
        if self.paused:
            logging.info("Continuando automação")
            self.paused = False
            self.pause_event.set()
    
    def toggle_pause(self):
        """Alterna entre pausar e continuar"""
        if self.paused:
            self.resume()
        else:
            self.pause()

def main():
    parser = argparse.ArgumentParser(description='Automação de Quiz Web')
    parser.add_argument('--embedded', action='store_true', help='Executar em modo embutido')
    parser.add_argument('--url', type=str, help='URL para automação')
    parser.add_argument('--question', type=str, default=".qtext", help='Seletor CSS para perguntas')
    parser.add_argument('--options', type=str, default="input[type='radio']", help='Seletor CSS para opções')
    parser.add_argument('--next', type=str, default="input[value='Próxima página']", help='Seletor CSS para botão de próxima')
    
    args = parser.parse_args()
    
    # Se estiver no modo embutido, lê a URL do arquivo se não for fornecida
    if args.embedded and not args.url:
        try:
            if os.path.exists('current_url.txt'):
                with open('current_url.txt', 'r') as f:
                    args.url = f.read().strip()
        except Exception as e:
            logging.error(f"Erro ao ler URL do arquivo: {e}")
    
    # Inicializa e executa a automação
    automation = WebQuizAutomation(
        url=args.url,
        question_selector=args.question,
        options_selector=args.options,
        next_button_selector=args.next
    )
    
    try:
        automation.run()
    except KeyboardInterrupt:
        logging.info("Automação interrompida pelo usuário")
        automation.stop()
    except Exception as e:
        logging.error(f"Erro na execução da automação: {e}")
        automation.stop()

if __name__ == "__main__":
    main()
