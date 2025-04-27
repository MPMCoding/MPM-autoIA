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
        """Configura o driver do Chrome para se conectar ao navegador embutido existente"""
        try:
            # Tenta ler a porta de depuração do arquivo criado pelo Electron
            debug_port = 9222  # Porta padrão caso não consiga ler do arquivo
            try:
                import os
                debug_port_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'debug_port.txt')
                if os.path.exists(debug_port_file):
                    with open(debug_port_file, 'r') as f:
                        port_str = f.read().strip()
                        if port_str.isdigit():
                            debug_port = int(port_str)
                            logging.info(f"Porta de depuração lida do arquivo: {debug_port}")
                        else:
                            logging.warning(f"Conteúdo do arquivo de porta inválido: {port_str}")
                else:
                    logging.warning(f"Arquivo de porta de depuração não encontrado: {debug_port_file}")
            except Exception as e:
                logging.warning(f"Erro ao ler porta de depuração do arquivo: {e}")
                logging.warning("Usando porta padrão 9222")
            
            # Conectar ao navegador embutido existente
            chrome_options = Options()
            
            # Usar a porta de depuração do navegador embutido
            debug_address = f"127.0.0.1:{debug_port}"
            logging.info(f"Tentando conectar ao navegador embutido em: {debug_address}")
            chrome_options.add_experimental_option("debuggerAddress", debug_address)
            
            # Configurações adicionais para evitar problemas
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            
            # Inicializa o driver conectando ao navegador existente
            from selenium.webdriver.chrome.service import Service
            from webdriver_manager.chrome import ChromeDriverManager
            
            try:
                # Tenta usar o ChromeDriverManager para obter o driver correto
                service = Service(ChromeDriverManager().install())
                self.driver = webdriver.Chrome(service=service, options=chrome_options)
                logging.info("Driver do Chrome inicializado com sucesso - conectado ao navegador embutido existente")
            except Exception as e:
                logging.warning(f"Falha ao usar ChromeDriverManager: {e}")
                # Fallback para inicialização direta
                self.driver = webdriver.Chrome(options=chrome_options)
                logging.info("Driver do Chrome inicializado com fallback - conectado ao navegador embutido existente")
            
            # Verifica se a conexão foi bem-sucedida
            current_url = self.driver.current_url
            logging.info(f"Conexão bem-sucedida! URL atual: {current_url}")
            
            return True
        except Exception as e:
            logging.error(f"Erro ao configurar o driver: {e}")
            logging.error("Detalhes do erro:")
            import traceback
            logging.error(traceback.format_exc())
            
            # Instruções para o usuário
            logging.error("\n" + "="*80)
            logging.error("INSTRUÇÕES PARA RESOLVER O PROBLEMA DE CONEXÃO:")
            logging.error("1. Certifique-se de que o navegador embutido está aberto e funcionando")
            logging.error("2. Verifique se você já está autenticado na página que deseja automatizar")
            logging.error("3. Instale as dependências necessárias:")
            logging.error("   pip install webdriver-manager selenium --upgrade")
            logging.error("4. Verifique se o arquivo debug_port.txt foi criado na pasta do aplicativo")
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
            return True
        except Exception as e:
            logging.error(f"Erro ao navegar para a URL: {e}")
            return False
    
    def process_quiz(self):
        """Processa o quiz automaticamente"""
        try:
            # Aumentar o timeout para dar mais tempo para a página carregar (de 10 para 30 segundos)
            logging.info("Aguardando a página carregar (timeout: 30 segundos)...")
            WebDriverWait(self.driver, 30).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, self.question_selector))
            )
            
            while self.running:
                # Verifica se está pausado
                self.pause_event.wait()
                
                # Encontra a pergunta atual
                try:
                    # Aumentar timeout para encontrar elementos (de 0 para 15 segundos)
                    wait = WebDriverWait(self.driver, 15)
                    question_element = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, self.question_selector)))
                    question_text = question_element.text.strip()
                    logging.info(f"Pergunta encontrada: {question_text}")
                    
                    # Encontra as opções com timeout
                    options = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, self.options_selector)))
                    
                    if options:
                        # Seleciona a primeira opção (pode ser modificado para usar IA para escolher a melhor opção)
                        wait.until(EC.element_to_be_clickable(options[0])).click()
                        logging.info(f"Selecionou a primeira opção")
                        
                        # Aguarda um pouco para simular comportamento humano
                        time.sleep(2)
                        
                        # Clica no botão de próxima com timeout
                        try:
                            next_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, self.next_button_selector)))
                            next_button.click()
                            logging.info("Clicou no botão de próxima página")
                            
                            # Aguarda a próxima pergunta carregar
                            time.sleep(3)
                        except TimeoutException:
                            logging.info("Timeout ao esperar pelo botão de próxima página. Pode ser a última pergunta.")
                            break
                        except NoSuchElementException:
                            logging.info("Botão de próxima página não encontrado. Pode ser a última pergunta.")
                            break
                    else:
                        logging.warning("Nenhuma opção encontrada para a pergunta atual")
                        break
                except TimeoutException:
                    logging.warning("Timeout ao aguardar elementos da pergunta. Tentando novamente...")
                    # Tenta recarregar a página se estiver tendo problemas
                    try:
                        current_url = self.driver.current_url
                        logging.info(f"Recarregando a página: {current_url}")
                        self.driver.refresh()
                        time.sleep(5)  # Aguarda o recarregamento
                        continue
                    except Exception as refresh_error:
                        logging.error(f"Erro ao recarregar a página: {refresh_error}")
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
            logging.error("Timeout ao aguardar elementos da página. Verifique se a página está carregada corretamente e se os seletores CSS estão corretos.")
            return False
        except Exception as e:
            logging.error(f"Erro ao processar o quiz: {e}")
            import traceback
            logging.error(traceback.format_exc())
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
