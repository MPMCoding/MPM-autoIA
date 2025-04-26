import os
import time
import logging
import threading
import tkinter as tk
import subprocess
from tkinter import ttk, scrolledtext, messagebox, filedialog
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.chrome.service import Service # Importar Service
from webdriver_manager.chrome import ChromeDriverManager # Importar ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from PIL import Image, ImageTk
from io import BytesIO

# Logo SVG do MPM AutoIA (azul em fundo branco, seguindo o estilo do codigoexemplo.html)
MPM_LOGO_SVG = """
<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
  <style>
    .text { font: bold 20px sans-serif; fill: #1a56db; }
    .brain { fill: none; stroke: #1a56db; stroke-width: 3; }
    .circuit { fill: none; stroke: #3b82f6; stroke-width: 2; stroke-dasharray: 5,3; }
  </style>
  <circle cx="60" cy="60" r="50" fill="#e1effe" stroke="#1a56db" stroke-width="3"/>
  <path class="brain" d="M40,45 C40,35 50,30 60,30 C70,30 80,35 80,45 C80,55 70,60 60,65 C50,60 40,55 40,45 Z"/>
  <path class="brain" d="M40,75 C40,65 50,60 60,60 C70,60 80,65 80,75 C80,85 70,90 60,90 C50,90 40,85 40,75 Z"/>
  <path class="circuit" d="M30,60 L90,60 M60,30 L60,90 M40,40 L80,80 M40,80 L80,40"/>
  <text class="text" x="60" y="105" text-anchor="middle">MPM</text>
</svg>
"""

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("automation.log"),
        logging.StreamHandler()
    ]
)

# Configuração da API do Google Gemini
GEMINI_API_KEY = "AIzaSyCq2WUCRoMFNC7_qY0uU30lESqvgndCBCU"
genai.configure(api_key=GEMINI_API_KEY)

class WebQuizAutomationGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("MPM AutoIA - Automação de Quiz Web")
        self.root.geometry("900x750")
        self.root.configure(bg="#f0f5ff")  # Fundo principal: azul claro como no codigoexemplo.html
        
        self.automation = None
        self.chrome_process = None
        self.chrome_path = self.find_chrome_path()
        self.user_data_dir = os.path.join(os.environ["TEMP"], "chrome_debug_profile")
        self.setup_ui()
    
    def find_chrome_path(self):
        """Encontra o caminho para o executável do Chrome"""
        # Locais comuns onde o Chrome pode estar instalado
        possible_paths = [
            os.path.join(os.environ.get("PROGRAMFILES", ""), "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(os.environ.get("PROGRAMFILES(X86)", ""), "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "Application", "chrome.exe")
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # Se não encontrar, retorna None e depois pediremos ao usuário
        return None
    
    def setup_ui(self):
        # Estilo para os widgets com a nova paleta de cores do codigoexemplo.html
        style = ttk.Style()
        style.configure("TFrame", background="#f0f5ff")
        style.configure("Card.TFrame", background="#ffffff")
        style.configure("TLabel", background="#f0f5ff", foreground="#1a1a1a", font=("Segoe UI", 10))
        style.configure("Card.TLabel", background="#ffffff")
        style.configure("Header.TLabel", font=("Segoe UI", 18, "bold"), foreground="#1a56db")
        style.configure("SubHeader.TLabel", font=("Segoe UI", 14, "bold"), foreground="#1a56db")
        style.configure("Info.TLabel", font=("Segoe UI", 9), foreground="#6b7280")
        
        # Definir classe para aplicar estilo de card com sombra
        class CardFrame(ttk.Frame):
            """Frame personalizado com estilo de card com sombra e bordas arredondadas"""
            def __init__(self, parent, **kwargs):
                super().__init__(parent, style="Card.TFrame", **kwargs)
                self.bind("<Map>", self._on_map)
                
            def _on_map(self, event):
                # Aplicar bordas arredondadas e sombra após o widget ser mapeado
                self.update_idletasks()
                # Criar efeito de sombra com frames sobrepostos
                shadow = tk.Frame(self.master, bg="#dbeafe", bd=0)
                shadow.place(x=self.winfo_x()+3, y=self.winfo_y()+3, 
                             width=self.winfo_width(), height=self.winfo_height())
                shadow.lower(self)
                # Criar borda arredondada (simulada)
                border = tk.Frame(self.master, bg="#ffffff", bd=0,
                                highlightbackground="#e1effe", highlightthickness=1)
                border.place(x=self.winfo_x(), y=self.winfo_y(), 
                            width=self.winfo_width(), height=self.winfo_height())
                border.lower(self)
        
        # Configurar estilo para os botões
        style.configure("TButton", 
                      font=("Segoe UI", 10, "bold"),
                      background="#1a56db",
                      foreground="#ffffff")
        
        style.map("TButton",
                 background=[("active", "#1e429f")],
                 foreground=[("active", "#ffffff")])
        
        style.configure("Secondary.TButton", 
                      background="#3b82f6",
                      foreground="#ffffff")
        
        style.map("Secondary.TButton",
                 background=[("active", "#2563eb")],
                 foreground=[("active", "#ffffff")])
        
        # Configurar estilo para os elementos de entrada
        style.configure("TEntry", fieldbackground="#ffffff", foreground="#1a1a1a")
        style.configure("TCombobox", fieldbackground="#ffffff", foreground="#1a1a1a")
        
        # Frame principal
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Card principal (container branco com sombra e bordas arredondadas)
        card_frame = ttk.Frame(main_frame, style="Card.TFrame")
        card_frame.pack(fill=tk.BOTH, expand=True, padx=0, pady=0)
        card_frame.configure(padding=15)
        
        # Aplicar estilo de card com sombra (simulado com borda)
        card_frame_border = tk.Frame(card_frame, bg="#e1effe", bd=0, highlightbackground="#e1effe", 
                                   highlightcolor="#e1effe", highlightthickness=1)
        card_frame_border.place(x=-5, y=-5, relwidth=1.01, relheight=1.01)
        card_frame_border.lower()
        
        # Logo e Título
        header_frame = ttk.Frame(card_frame, style="Card.TFrame")
        header_frame.pack(fill=tk.X, pady=(0, 20))
        
        # Converter SVG para imagem Tkinter
        try:
            from cairosvg import svg2png
            png_data = BytesIO()
            svg2png(bytestring=MPM_LOGO_SVG.encode("utf-8"), write_to=png_data)
            png_data.seek(0)
            logo_img = Image.open(png_data)
        except ImportError:
            # Fallback se cairosvg não estiver disponível
            # Criar uma imagem simples com texto
            logo_img = Image.new("RGBA", (120, 120), (225, 239, 254, 255))
        
        logo_photo = ImageTk.PhotoImage(logo_img)
        
        # Criar um frame para o logo e texto
        logo_text_frame = ttk.Frame(header_frame, style="Card.TFrame")
        logo_text_frame.pack(pady=(0, 10))
        
        # Adicionar o logo
        logo_label = ttk.Label(logo_text_frame, image=logo_photo, background="#ffffff")
        logo_label.image = logo_photo  # Manter referência para evitar coleta de lixo
        logo_label.pack(side=tk.LEFT, padx=(0, 15))
        
        # Frame para título e subtítulo
        text_frame = ttk.Frame(logo_text_frame, style="Card.TFrame")
        text_frame.pack(side=tk.LEFT)
        
        title_label = ttk.Label(text_frame, text="MPM AutoIA", style="Header.TLabel")
        title_label.pack(anchor=tk.W)
        
        subtitle_label = ttk.Label(text_frame, text="Automação Inteligente de Quiz Web", style="SubHeader.TLabel")
        subtitle_label.pack(anchor=tk.W)
        
        # Separador
        separator0 = ttk.Separator(card_frame, orient="horizontal")
        separator0.pack(fill=tk.X, pady=10)
        
        # Frame para Chrome
        chrome_frame = CardFrame(card_frame)
        chrome_frame.pack(fill=tk.X, pady=10)
        
        chrome_label = ttk.Label(chrome_frame, text="Configuração do Chrome", style="SubHeader.TLabel")
        chrome_label.pack(anchor=tk.W, padx=5, pady=(0, 10))
        
        # Frame para caminho do Chrome
        chrome_path_frame = ttk.Frame(chrome_frame, style="Card.TFrame")
        chrome_path_frame.configure(padding=5)
        chrome_path_frame.pack(fill=tk.X, pady=5)
        
        path_label = ttk.Label(chrome_path_frame, text="Caminho do Chrome:", style="Card.TLabel")
        path_label.pack(side=tk.LEFT, padx=5)
        
        self.chrome_path_entry = ttk.Entry(chrome_path_frame, width=50)
        self.chrome_path_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        if self.chrome_path:
            self.chrome_path_entry.insert(0, self.chrome_path)
        
        browse_button = ttk.Button(chrome_path_frame, text="Procurar", command=self.browse_chrome, style="Secondary.TButton")
        browse_button.pack(side=tk.LEFT, padx=5)
        
        # Frame para porta de depuração
        remote_frame = ttk.Frame(chrome_frame, style="Card.TFrame")
        remote_frame.configure(padding=5)
        remote_frame.pack(fill=tk.X, pady=10)
        
        remote_label = ttk.Label(remote_frame, text="Porta de depuração:", style="Card.TLabel")
        remote_label.pack(side=tk.LEFT, padx=5)
        
        self.port_entry = ttk.Entry(remote_frame, width=10)
        self.port_entry.pack(side=tk.LEFT, padx=5)
        self.port_entry.insert(0, "9222")
        
        # Botão para iniciar o Chrome
        chrome_button_frame = ttk.Frame(chrome_frame, style="Card.TFrame")
        chrome_button_frame.configure(padding=5)
        chrome_button_frame.pack(fill=tk.X, pady=10)
        
        self.start_chrome_button = ttk.Button(chrome_button_frame, 
                                             text="Iniciar Chrome em Modo Depuração", 
                                             command=self.start_chrome)
        self.start_chrome_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        self.chrome_status_label = ttk.Label(chrome_button_frame, text="Chrome não iniciado", style="Info.TLabel")
        self.chrome_status_label.pack(side=tk.LEFT, padx=10)
        
        # Separador
        separator = ttk.Separator(card_frame, orient="horizontal")
        separator.pack(fill=tk.X, pady=15)
        
        # Frame para seletores
        selectors_frame_title = ttk.Label(card_frame, text="Configuração dos Seletores CSS", style="SubHeader.TLabel")
        selectors_frame_title.pack(anchor=tk.W, padx=5, pady=(5, 10))
        
        selectors_frame = CardFrame(card_frame)
        selectors_frame.pack(fill=tk.X, pady=5)
        
        # Seletor de pergunta
        question_label = ttk.Label(selectors_frame, text="Seletor da pergunta:", style="Card.TLabel")
        question_label.grid(row=0, column=0, padx=5, pady=8, sticky=tk.W)
        
        self.question_selector = ttk.Entry(selectors_frame, width=40)
        self.question_selector.grid(row=0, column=1, padx=5, pady=8, sticky=tk.W+tk.E)
        self.question_selector.insert(0, ".qtext")
        
        # Seletor de opções
        options_label = ttk.Label(selectors_frame, text="Seletor das opções:", style="Card.TLabel")
        options_label.grid(row=1, column=0, padx=5, pady=8, sticky=tk.W)
        
        self.options_selector = ttk.Entry(selectors_frame, width=40)
        self.options_selector.grid(row=1, column=1, padx=5, pady=8, sticky=tk.W+tk.E)
        self.options_selector.insert(0, "input[type=\"radio\"]")
        
        # Seletor do botão próxima
        next_button_label = ttk.Label(selectors_frame, text="Seletor do botão próxima:", style="Card.TLabel")
        next_button_label.grid(row=2, column=0, padx=5, pady=8, sticky=tk.W)
        
        self.next_button_selector = ttk.Entry(selectors_frame, width=40)
        self.next_button_selector.grid(row=2, column=1, padx=5, pady=8, sticky=tk.W+tk.E)
        self.next_button_selector.insert(0, "input[value=\"Próxima página\"]")
        
        # Configurar o grid para expandir
        selectors_frame.columnconfigure(1, weight=1)
        
        # Separador
        separator2 = ttk.Separator(card_frame, orient="horizontal")
        separator2.pack(fill=tk.X, pady=15)
        
        # Botões de controle
        control_frame_title = ttk.Label(card_frame, text="Controles da Automação", style="SubHeader.TLabel")
        control_frame_title.pack(anchor=tk.W, padx=5, pady=(5, 10))
        
        control_frame = CardFrame(card_frame)
        control_frame.pack(fill=tk.X, pady=5)
        
        self.start_button = ttk.Button(control_frame, text="Iniciar Automação", command=self.start_automation)
        self.start_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        self.pause_button = ttk.Button(control_frame, text="Pausar", command=self.toggle_pause, state=tk.DISABLED, style="Secondary.TButton")
        self.pause_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        self.stop_button = ttk.Button(control_frame, text="Parar", command=self.stop_automation, state=tk.DISABLED, style="Secondary.TButton")
        self.stop_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        # Separador
        separator3 = ttk.Separator(card_frame, orient="horizontal")
        separator3.pack(fill=tk.X, pady=15)
        
        # Área de log
        log_frame = CardFrame(card_frame)
        log_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        log_label = ttk.Label(log_frame, text="Log de Execução", style="SubHeader.TLabel")
        log_label.pack(anchor=tk.W, padx=5, pady=(0, 10))
        
        # Estilo para a área de log
        self.log_area = scrolledtext.ScrolledText(log_frame, height=15, width=80, bg="#ffffff", fg="#1a56db", font=("Consolas", 9))
        self.log_area.pack(fill=tk.BOTH, expand=True, pady=5)
        self.log_area.configure(borderwidth=1, relief="solid")
        
        # Configurar handler de log personalizado
        self.log_handler = LogHandler(self.log_area)
        logging.getLogger().addHandler(self.log_handler)
        
        # Adicionar informação de status na parte inferior
        status_frame = CardFrame(card_frame)
        status_frame.pack(fill=tk.X, pady=(10, 0))
        
        status_label = ttk.Label(status_frame, text="MPM AutoIA v1.0 - Pronto para uso", style="Info.TLabel")
        status_label.pack(side=tk.RIGHT)
    
    def browse_chrome(self):
        """Abre um diálogo para selecionar o executável do Chrome"""
        chrome_path = filedialog.askopenfilename(
            title="Selecione o executável do Chrome",
            filetypes=[("Executáveis", "*.exe")],
            initialdir=os.environ.get("PROGRAMFILES", "")
        )
        if chrome_path:
            self.chrome_path_entry.delete(0, tk.END)
            self.chrome_path_entry.insert(0, chrome_path)
            self.chrome_path = chrome_path
    
    def start_chrome(self):
        """Inicia o Chrome em modo de depuração remota"""
        try:
            # Obter o caminho do Chrome e a porta
            chrome_path = self.chrome_path_entry.get()
            port = self.port_entry.get()
            
            if not chrome_path or not os.path.exists(chrome_path):
                messagebox.showerror("MPM AutoIA - Erro", "Caminho do Chrome inválido. Por favor, selecione o executável correto.")
                return
            
            if not port.isdigit():
                messagebox.showerror("MPM AutoIA - Erro", "Porta de depuração inválida. Insira um número.")
                return
            
            # Comando para iniciar o Chrome
            command = [
                chrome_path,
                f"--remote-debugging-port={port}",
                f"--user-data-dir={self.user_data_dir}"
            ]
            
            logging.info(f"Iniciando Chrome com comando: {" ".join(command)}")
            
            # Iniciar o processo do Chrome
            self.chrome_process = subprocess.Popen(command)
            self.chrome_status_label.config(text=f"Chrome iniciado na porta {port}", foreground="green")
            logging.info(f"Chrome iniciado com sucesso na porta {port}.")
            
        except Exception as e:
            logging.error(f"Erro ao iniciar o Chrome: {e}")
            messagebox.showerror("MPM AutoIA - Erro", f"Falha ao iniciar o Chrome: {e}")
            self.chrome_status_label.config(text="Falha ao iniciar Chrome", foreground="red")

    def start_automation(self):
        """Inicia a automação em uma thread separada"""
        if self.automation and self.automation.is_running:
            logging.warning("Automação já está em execução.")
            return
            
        # Obter seletores e porta
        question_selector = self.question_selector.get()
        options_selector = self.options_selector.get()
        next_button_selector = self.next_button_selector.get()
        port = self.port_entry.get()
        
        if not all([question_selector, options_selector, next_button_selector, port]):
            messagebox.showerror("MPM AutoIA - Erro", "Por favor, preencha todos os seletores e a porta de depuração.")
            return
            
        if not port.isdigit():
            messagebox.showerror("MPM AutoIA - Erro", "Porta de depuração inválida.")
            return
        
        # Instanciar e iniciar a automação
        self.automation = WebQuizAutomation(
            port=int(port),
            question_selector=question_selector,
            options_selector=options_selector,
            next_button_selector=next_button_selector
        )
        
        self.automation_thread = threading.Thread(target=self.automation.run, daemon=True)
        self.automation_thread.start()
        
        # Atualizar UI
        self.start_button.config(state=tk.DISABLED)
        self.pause_button.config(state=tk.NORMAL, text="Pausar")
        self.stop_button.config(state=tk.NORMAL)
        logging.info("Automação iniciada.")

    def toggle_pause(self):
        """Pausa ou retoma a automação"""
        if self.automation:
            if self.automation.is_paused:
                self.automation.resume()
                self.pause_button.config(text="Pausar")
                logging.info("Automação retomada.")
            else:
                self.automation.pause()
                self.pause_button.config(text="Retomar")
                logging.info("Automação pausada.")

    def stop_automation(self):
        """Para a automação"""
        if self.automation:
            self.automation.stop()
            # Aguardar a thread terminar (opcional, mas bom para limpeza)
            # self.automation_thread.join(timeout=2)
            
            # Atualizar UI
            self.start_button.config(state=tk.NORMAL)
            self.pause_button.config(state=tk.DISABLED, text="Pausar")
            self.stop_button.config(state=tk.DISABLED)
            logging.info("Automação parada pelo usuário.")
            self.automation = None # Limpar referência

    def on_close(self):
        """Chamado quando a janela é fechada"""
        if self.automation and self.automation.is_running:
            self.stop_automation()
            
        if self.chrome_process:
            logging.info("Fechando processo do Chrome...")
            try:
                self.chrome_process.terminate() # Tenta terminar graciosamente
                self.chrome_process.wait(timeout=5) # Espera um pouco
            except subprocess.TimeoutExpired:
                logging.warning("Processo do Chrome não terminou, forçando...")
                self.chrome_process.kill() # Força o fechamento
            except Exception as e:
                logging.error(f"Erro ao fechar o Chrome: {e}")
                
        self.root.destroy()

class WebQuizAutomation:
    def __init__(self, port, question_selector, options_selector, next_button_selector):
        self.port = port
        self.question_selector = question_selector
        self.options_selector = options_selector
        self.next_button_selector = next_button_selector
        self.driver = None
        self.is_running = False
        self.is_paused = False
        self.stop_event = threading.Event()
        self.pause_event = threading.Event()
        self.pause_event.set() # Inicia não pausado
        
        # Configurar modelo Gemini
        self.model = genai.GenerativeModel("gemini-pro")

    def setup_driver(self):
        """Configura o WebDriver para se conectar ao Chrome existente"""
        try:
            logging.info(f"Tentando conectar ao Chrome na porta {self.port}...")
            options = webdriver.ChromeOptions()
            options.add_experimental_option("debuggerAddress", f"127.0.0.1:{self.port}")
            
            # Configuração mais robusta para o ChromeDriver
            logging.info("Configurando ChromeDriver com abordagem robusta...")
            
            # Método 1: Usar webdriver-manager com opções avançadas
            from webdriver_manager.chrome import ChromeDriverManager
            from webdriver_manager.core.utils import ChromeType
            
            # Tenta diferentes estratégias para obter o ChromeDriver correto
            try:
                # Tenta com configuração padrão
                driver_path = ChromeDriverManager().install()
                logging.info(f"ChromeDriver instalado em: {driver_path}")
                service = Service(executable_path=driver_path)
            except Exception as driver_error:
                logging.warning(f"Falha no método padrão de obtenção do ChromeDriver: {driver_error}")
                try:
                    # Tenta com configuração alternativa
                    driver_path = ChromeDriverManager(chrome_type=ChromeType.CHROMIUM).install()
                    logging.info(f"ChromeDriver (Chromium) instalado em: {driver_path}")
                    service = Service(executable_path=driver_path)
                except Exception as chromium_error:
                    logging.warning(f"Falha no método alternativo: {chromium_error}")
                    
                    # Método 2: Usar o Selenium Manager diretamente (disponível no Selenium 4.6+)
                    logging.info("Tentando usar Selenium Manager diretamente...")
                    service = Service()
            
            # Configuração adicional para evitar problemas de compatibilidade
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            
            # Inicializa o driver com as opções configuradas
            logging.info("Inicializando Chrome WebDriver...")
            self.driver = webdriver.Chrome(service=service, options=options)
            logging.info("WebDriver conectado com sucesso ao Chrome existente.")
            return True
        except Exception as e:
            logging.error(f"Erro ao configurar o driver: {e}")
            logging.error("Detalhes do erro para diagnóstico:")
            import traceback
            logging.error(traceback.format_exc())
            return False

    def get_question_and_options(self):
        """Extrai o texto da pergunta e das opções da página atual"""
        try:
            wait = WebDriverWait(self.driver, 10)
            question_element = wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, self.question_selector)))
            question_text = question_element.text
            
            option_elements = self.driver.find_elements(By.CSS_SELECTOR, self.options_selector)
            options = []
            for option in option_elements:
                # Tenta encontrar o texto associado ao radio button (geralmente no label pai ou irmão)
                try:
                    # Tenta encontrar o label pai
                    label = option.find_element(By.XPATH, "./ancestor::label")
                    option_text = label.text
                except NoSuchElementException:
                    try:
                        # Tenta encontrar o label irmão
                        label = option.find_element(By.XPATH, "./following-sibling::label | ./preceding-sibling::label")
                        option_text = label.text
                    except NoSuchElementException:
                        try:
                            # Tenta encontrar texto dentro de um span irmão
                            span = option.find_element(By.XPATH, "./following-sibling::span | ./preceding-sibling::span")
                            option_text = span.text
                        except NoSuchElementException:
                            # Fallback: usa o valor do atributo 'value' se não encontrar texto
                            option_text = option.get_attribute("value") or "Opção sem texto"
                
                if option_text:
                    options.append(option_text.strip())
            
            logging.info(f"Pergunta encontrada: {question_text[:50]}...")
            logging.info(f"Opções encontradas: {options}")
            return question_text, options
        except TimeoutException:
            logging.error("Tempo esgotado ao esperar pela pergunta ou opções.")
            return None, None
        except Exception as e:
            logging.error(f"Erro ao extrair pergunta/opções: {e}")
            return None, None

    def get_gemini_answer(self, question, options):
        """Usa a API Gemini para obter a resposta correta"""
        try:
            prompt = f"Dada a seguinte pergunta de múltipla escolha e suas opções, qual é a resposta correta? Retorne APENAS o texto exato da opção correta.\n\nPergunta: {question}\n\nOpções:\n" + "\n".join([f"- {opt}" for opt in options])
            
            logging.info("Enviando prompt para Gemini...")
            response = self.model.generate_content(prompt)
            answer_text = response.text.strip()
            logging.info(f"Resposta recebida do Gemini: {answer_text}")
            
            # Validar se a resposta do Gemini corresponde a uma das opções
            for option in options:
                if answer_text.lower() == option.lower():
                    return option # Retorna a opção original para correspondência exata
            
            logging.warning(f"Resposta do Gemini (\"{answer_text}\") não corresponde exatamente a nenhuma opção. Tentando correspondência parcial.")
            # Tenta correspondência parcial se a exata falhar
            for option in options:
                if answer_text.lower() in option.lower() or option.lower() in answer_text.lower():
                    logging.info(f"Correspondência parcial encontrada: {option}")
                    return option
            
            logging.error("Não foi possível encontrar uma opção correspondente à resposta do Gemini.")
            return None
            
        except Exception as e:
            logging.error(f"Erro ao obter resposta do Gemini: {e}")
            return None

    def select_answer_and_next(self, correct_option_text):
        """Seleciona a opção correta e clica no botão Próxima"""
        try:
            option_elements = self.driver.find_elements(By.CSS_SELECTOR, self.options_selector)
            selected = False
            for option in option_elements:
                option_label_text = ""
                try:
                    label = option.find_element(By.XPATH, "./ancestor::label")
                    option_label_text = label.text.strip()
                except NoSuchElementException:
                    try:
                        label = option.find_element(By.XPATH, "./following-sibling::label | ./preceding-sibling::label")
                        option_label_text = label.text.strip()
                    except NoSuchElementException:
                         try:
                            span = option.find_element(By.XPATH, "./following-sibling::span | ./preceding-sibling::span")
                            option_label_text = span.text.strip()
                         except NoSuchElementException:
                            option_label_text = option.get_attribute("value") or ""
                
                if option_label_text.lower() == correct_option_text.lower():
                    logging.info(f"Selecionando opção: {option_label_text}")
                    # Usar JavaScript para clicar pode ser mais robusto
                    self.driver.execute_script("arguments[0].click();", option)
                    # option.click() # Método padrão
                    selected = True
                    break
            
            if not selected:
                logging.error(f"Não foi possível encontrar o elemento da opção: {correct_option_text}")
                return False

            time.sleep(1) # Pequena pausa após selecionar

            next_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, self.next_button_selector))
            )
            logging.info("Clicando no botão Próxima.")
            # Usar JavaScript para clicar
            self.driver.execute_script("arguments[0].click();", next_button)
            # next_button.click() # Método padrão
            return True
            
        except TimeoutException:
            logging.error("Tempo esgotado ao esperar pelo botão Próxima.")
            return False
        except Exception as e:
            logging.error(f"Erro ao selecionar resposta ou clicar em Próxima: {e}")
            return False

    def run(self):
        """Loop principal da automação"""
        self.is_running = True
        self.stop_event.clear()
        
        if not self.setup_driver():
            self.is_running = False
            messagebox.showerror("MPM AutoIA - Erro", "Falha ao conectar ao Chrome. Verifique se ele está em modo de depuração na porta correta.")
            # Atualizar UI via callback ou fila seria ideal aqui
            return

        while not self.stop_event.is_set():
            self.pause_event.wait() # Bloqueia aqui se pausado
            
            if self.stop_event.is_set(): # Verifica novamente após pausa
                break
                
            logging.info("--- Nova Iteração ---")
            question, options = self.get_question_and_options()
            
            if question and options:
                correct_option = self.get_gemini_answer(question, options)
                if correct_option:
                    if not self.select_answer_and_next(correct_option):
                        logging.error("Falha ao selecionar/avançar. Parando automação.")
                        break
                else:
                    logging.error("Não foi possível obter resposta do Gemini. Parando automação.")
                    break
            else:
                logging.warning("Não foi possível encontrar pergunta/opções. Verifique os seletores ou o estado da página. Tentando novamente em 5s...")
                # Verificar se ainda estamos na mesma URL ou se algo mudou
                try:
                    current_url = self.driver.current_url
                    logging.info(f"URL atual: {current_url}")
                    # Poderia adicionar lógica aqui para detectar fim do quiz ou erro
                except Exception as e:
                    logging.error(f"Erro ao obter URL atual: {e}. Parando automação.")
                    break
                time.sleep(5)
                continue # Tenta novamente
                
            time.sleep(3) # Pausa entre perguntas
            
        logging.info("Loop de automação encerrado.")
        if self.driver:
            try:
                # Não fechar o driver, pois ele está conectado a um Chrome externo
                # self.driver.quit()
                logging.info("WebDriver desconectado (não fechado).")
            except Exception as e:
                logging.error(f"Erro ao tentar desconectar o WebDriver: {e}")
        self.is_running = False
        self.is_paused = False
        # Idealmente, sinalizar para a GUI que parou

    def pause(self):
        self.pause_event.clear() # Bloqueia a thread no wait()
        self.is_paused = True

    def resume(self):
        self.pause_event.set() # Libera a thread do wait()
        self.is_paused = False

    def stop(self):
        self.stop_event.set()
        self.pause_event.set() # Garante que saia do pause para verificar stop
        self.is_running = False

class LogHandler(logging.Handler):
    """Handler personalizado para direcionar logs para a área de texto Tkinter"""
    def __init__(self, text_widget):
        super().__init__()
        self.text_widget = text_widget

    def emit(self, record):
        msg = self.format(record)
        def append():
            self.text_widget.configure(state="normal")
            self.text_widget.insert(tk.END, msg + "\n")
            self.text_widget.configure(state="disabled")
            self.text_widget.yview(tk.END)
        # Usar after para garantir que a atualização da UI ocorra na thread principal
        self.text_widget.after(0, append)

if __name__ == "__main__":
    root = tk.Tk()
    app = WebQuizAutomationGUI(root)
    root.protocol("WM_DELETE_WINDOW", app.on_close) # Lidar com fechamento da janela
    root.mainloop()

