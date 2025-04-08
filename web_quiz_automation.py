import os
import time
import logging
import threading
import tkinter as tk
import subprocess
from tkinter import ttk, scrolledtext, messagebox, filedialog
import google.generativeai as genai
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from PIL import Image, ImageTk
from io import BytesIO

# Logo SVG do MPM AutoIA (amarelo vibrante em fundo transparente)
MPM_LOGO_SVG = '''
<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
  <style>
    .text { font: bold 20px sans-serif; fill: #FFD700; }
    .brain { fill: none; stroke: #FFD700; stroke-width: 3; }
    .circuit { fill: none; stroke: #FFD700; stroke-width: 2; stroke-dasharray: 5,3; }
  </style>
  <circle cx="60" cy="60" r="50" fill="#0D0D0D" stroke="#FFD700" stroke-width="3"/>
  <path class="brain" d="M40,45 C40,35 50,30 60,30 C70,30 80,35 80,45 C80,55 70,60 60,65 C50,60 40,55 40,45 Z"/>
  <path class="brain" d="M40,75 C40,65 50,60 60,60 C70,60 80,65 80,75 C80,85 70,90 60,90 C50,90 40,85 40,75 Z"/>
  <path class="circuit" d="M30,60 L90,60 M60,30 L60,90 M40,40 L80,80 M40,80 L80,40"/>
  <text class="text" x="60" y="105" text-anchor="middle">MPM</text>
</svg>
'''

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
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
        self.root.geometry("800x700")
        self.root.configure(bg="#0D0D0D")  # Fundo principal: preto profundo
        
        self.automation = None
        self.chrome_process = None
        self.chrome_path = self.find_chrome_path()
        self.user_data_dir = os.path.join(os.environ['TEMP'], "chrome_debug_profile")
        self.setup_ui()
    
    def find_chrome_path(self):
        """Encontra o caminho para o executável do Chrome"""
        # Locais comuns onde o Chrome pode estar instalado
        possible_paths = [
            os.path.join(os.environ.get('PROGRAMFILES', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
            os.path.join(os.environ.get('PROGRAMFILES(X86)', ''), 'Google', 'Chrome', 'Application', 'chrome.exe'),
            os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Google', 'Chrome', 'Application', 'chrome.exe')
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        # Se não encontrar, retorna None e depois pediremos ao usuário
        return None
    
    def setup_ui(self):
        # Estilo para os widgets com a nova paleta de cores
        style = ttk.Style()
        style.configure("TFrame", background="#0D0D0D")  # Fundo principal: preto profundo
        style.configure("TLabel", background="#0D0D0D", foreground="#FFFFFF", font=("Helvetica", 10))  # Texto principal: branco puro
        style.configure("TButton", background="#FFD700", foreground="#0D0D0D", font=("Helvetica", 10, "bold"))  # Botões: amarelo vibrante com texto preto
        style.configure("Header.TLabel", font=("Helvetica", 18, "bold"), foreground="#FFD700")  # Título: amarelo vibrante
        style.configure("SubHeader.TLabel", font=("Helvetica", 12, "bold"), foreground="#FFD700")  # Subtítulo: amarelo vibrante
        style.configure("Info.TLabel", font=("Helvetica", 9, "italic"), foreground="#BFBFBF")  # Texto secundário: cinza claro
        
        # Configurar estilo para os elementos de entrada
        style.configure("TEntry", fieldbackground="#1E1E1E", foreground="#FFFFFF", insertcolor="#FFFFFF")
        style.map("TButton",
                 background=[("active", "#FF8C00")],  # Hover: laranja queimado
                 foreground=[("active", "#FFFFFF")])  # Texto branco no hover
        
        # Frame principal
        main_frame = ttk.Frame(self.root, style="TFrame")
        main_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        # Logo e Título
        title_frame = ttk.Frame(main_frame, style="TFrame")
        title_frame.pack(fill=tk.X, pady=(0, 15))
        
        # Converter SVG para imagem Tkinter
        try:
            from cairosvg import svg2png
            png_data = BytesIO()
            svg2png(bytestring=MPM_LOGO_SVG.encode('utf-8'), write_to=png_data)
            png_data.seek(0)
            logo_img = Image.open(png_data)
        except ImportError:
            # Fallback se cairosvg não estiver disponível
            # Criar uma imagem simples com texto
            logo_img = Image.new('RGBA', (120, 120), (13, 13, 13, 0))
        
        logo_photo = ImageTk.PhotoImage(logo_img)
        
        # Criar um frame para o logo e texto
        logo_text_frame = ttk.Frame(title_frame, style="TFrame")
        logo_text_frame.pack(pady=(0, 10))
        
        # Adicionar o logo
        logo_label = ttk.Label(logo_text_frame, image=logo_photo, background="#0D0D0D")
        logo_label.image = logo_photo  # Manter referência para evitar coleta de lixo
        logo_label.pack(side=tk.LEFT, padx=(0, 10))
        
        # Frame para título e subtítulo
        text_frame = ttk.Frame(logo_text_frame, style="TFrame")
        text_frame.pack(side=tk.LEFT)
        
        title_label = ttk.Label(text_frame, text='MPM AutoIA', style="Header.TLabel")
        title_label.pack(anchor=tk.W)
        
        subtitle_label = ttk.Label(text_frame, text='Automação Inteligente de Quiz Web', style="SubHeader.TLabel")
        subtitle_label.pack(anchor=tk.W)
        
        # Frame para Chrome
        chrome_frame = ttk.Frame(main_frame, style="TFrame")
        chrome_frame.pack(fill=tk.X, pady=10)
        
        chrome_label = ttk.Label(chrome_frame, text="Configuração do Chrome:", style="SubHeader.TLabel")
        chrome_label.pack(anchor=tk.W, padx=5, pady=(0, 5))
        
        # Frame para caminho do Chrome
        chrome_path_frame = ttk.Frame(chrome_frame, style="TFrame")
        chrome_path_frame.pack(fill=tk.X, pady=5)
        
        path_label = ttk.Label(chrome_path_frame, text="Caminho do Chrome:", style="TLabel")
        path_label.pack(side=tk.LEFT, padx=5)
        
        self.chrome_path_entry = ttk.Entry(chrome_path_frame, width=40)
        self.chrome_path_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)
        if self.chrome_path:
            self.chrome_path_entry.insert(0, self.chrome_path)
        
        browse_button = ttk.Button(chrome_path_frame, text="Procurar", command=self.browse_chrome)
        browse_button.pack(side=tk.LEFT, padx=5)
        
        # Frame para porta de depuração
        remote_frame = ttk.Frame(chrome_frame, style="TFrame")
        remote_frame.pack(fill=tk.X, pady=5)
        
        remote_label = ttk.Label(remote_frame, text="Porta de depuração:", style="TLabel")
        remote_label.pack(side=tk.LEFT, padx=5)
        
        self.port_entry = ttk.Entry(remote_frame, width=10)
        self.port_entry.pack(side=tk.LEFT, padx=5)
        self.port_entry.insert(0, "9222")
        
        # Botão para iniciar o Chrome
        chrome_button_frame = ttk.Frame(chrome_frame, style="TFrame")
        chrome_button_frame.pack(fill=tk.X, pady=10)
        
        self.start_chrome_button = ttk.Button(chrome_button_frame, text="Iniciar Chrome em Modo Depuração", command=self.start_chrome)
        self.start_chrome_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        self.chrome_status_label = ttk.Label(chrome_button_frame, text="Chrome não iniciado", style="Info.TLabel")
        self.chrome_status_label.pack(side=tk.LEFT, padx=10)
        
        # Separador
        separator = ttk.Separator(main_frame, orient='horizontal')
        separator.pack(fill=tk.X, pady=10)
        
        # Frame para seletores
        selectors_frame_title = ttk.Label(main_frame, text="Configuração dos Seletores CSS:", style="SubHeader.TLabel")
        selectors_frame_title.pack(anchor=tk.W, padx=5, pady=(5, 5))
        
        selectors_frame = ttk.Frame(main_frame, style="TFrame")
        selectors_frame.pack(fill=tk.X, pady=5)
        
        # Seletor de pergunta
        question_label = ttk.Label(selectors_frame, text="Seletor da pergunta:", style="TLabel")
        question_label.grid(row=0, column=0, padx=5, pady=5, sticky=tk.W)
        
        self.question_selector = ttk.Entry(selectors_frame, width=40)
        self.question_selector.grid(row=0, column=1, padx=5, pady=5, sticky=tk.W+tk.E)
        self.question_selector.insert(0, ".qtext")
        
        # Seletor de opções
        options_label = ttk.Label(selectors_frame, text="Seletor das opções:", style="TLabel")
        options_label.grid(row=1, column=0, padx=5, pady=5, sticky=tk.W)
        
        self.options_selector = ttk.Entry(selectors_frame, width=40)
        self.options_selector.grid(row=1, column=1, padx=5, pady=5, sticky=tk.W+tk.E)
        self.options_selector.insert(0, "input[type='radio']")
        
        # Seletor do botão próxima
        next_button_label = ttk.Label(selectors_frame, text="Seletor do botão próxima:", style="TLabel")
        next_button_label.grid(row=2, column=0, padx=5, pady=5, sticky=tk.W)
        
        self.next_button_selector = ttk.Entry(selectors_frame, width=40)
        self.next_button_selector.grid(row=2, column=1, padx=5, pady=5, sticky=tk.W+tk.E)
        self.next_button_selector.insert(0, "input[value='Próxima página']")
        
        # Configurar o grid para expandir
        selectors_frame.columnconfigure(1, weight=1)
        
        # Separador
        separator2 = ttk.Separator(main_frame, orient='horizontal')
        separator2.pack(fill=tk.X, pady=10)
        
        # Botões de controle
        control_frame_title = ttk.Label(main_frame, text="Controles da Automação:", style="SubHeader.TLabel")
        control_frame_title.pack(anchor=tk.W, padx=5, pady=(5, 5))
        
        control_frame = ttk.Frame(main_frame, style="TFrame")
        control_frame.pack(fill=tk.X, pady=5)
        
        self.start_button = ttk.Button(control_frame, text="Iniciar Automação", command=self.start_automation)
        self.start_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        self.pause_button = ttk.Button(control_frame, text="Pausar", command=self.toggle_pause, state=tk.DISABLED)
        self.pause_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        self.stop_button = ttk.Button(control_frame, text="Parar", command=self.stop_automation, state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT, padx=5, pady=5)
        
        # Separador
        separator3 = ttk.Separator(main_frame, orient='horizontal')
        separator3.pack(fill=tk.X, pady=10)
        
        # Área de log
        log_label = ttk.Label(main_frame, text="Log de Execução:", style="SubHeader.TLabel")
        log_label.pack(anchor=tk.W, padx=5, pady=(5, 5))
        
        self.log_area = scrolledtext.ScrolledText(main_frame, height=15, width=80, bg="#1E1E1E", fg="#FFD700", font=("Consolas", 9))
        self.log_area.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # Configurar handler de log personalizado
        self.log_handler = LogHandler(self.log_area)
        logging.getLogger().addHandler(self.log_handler)
    
    def browse_chrome(self):
        """Abre um diálogo para selecionar o executável do Chrome"""
        chrome_path = filedialog.askopenfilename(
            title="Selecione o executável do Chrome",
            filetypes=[("Executáveis", "*.exe")],
            initialdir=os.environ.get('PROGRAMFILES', '')
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
                messagebox.showerror("MPM AutoIA - Erro", "Porta inválida. Por favor, insira um número de porta válido.")
                return
            
            # Garantir que o diretório de perfil exista
            os.makedirs(self.user_data_dir, exist_ok=True)
            
            # Construir o comando
            cmd = [
                chrome_path,
                f"--remote-debugging-port={port}",
                f"--user-data-dir={self.user_data_dir}"
            ]
            
            # Iniciar o Chrome como um processo separado
            self.chrome_process = subprocess.Popen(cmd)
            
            # Atualizar a interface
            self.chrome_status_label.config(text=f"Chrome iniciado na porta {port}")
            self.start_chrome_button.config(state=tk.DISABLED)
            
            logging.info(f"Chrome iniciado em modo de depuração na porta {port}")
            
            # Mostrar mensagem com a nova paleta de cores
            messagebox.showinfo("MPM AutoIA", f"Chrome iniciado em modo de depuração na porta {port}")
            # Configurar estilo para as caixas de diálogo
            self.root.option_add('*Dialog.msg.font', 'Helvetica 10')
            self.root.option_add('*Dialog.msg.background', '#0D0D0D')
            self.root.option_add('*Dialog.msg.foreground', '#FFFFFF')
            
        except Exception as e:
            logging.error(f"Erro ao iniciar o Chrome: {e}")
            messagebox.showerror("MPM AutoIA - Erro", f"Falha ao iniciar o Chrome: {e}")
    
    def start_automation(self):
        port = self.port_entry.get()
        question_selector = self.question_selector.get()
        options_selector = self.options_selector.get()
        next_button_selector = self.next_button_selector.get()
        
        if not port.isdigit():
            messagebox.showerror("MPM AutoIA - Erro", "Porta inválida. Por favor, insira um número de porta válido.")
            return
        
        # Desabilitar botão de iniciar e habilitar botões de controle
        self.start_button.config(state=tk.DISABLED)
        self.pause_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.NORMAL)
        
        # Iniciar a automação em uma thread separada
        self.automation = WebQuizAutomation(
            port=port,
            question_selector=question_selector,
            options_selector=options_selector,
            next_button_selector=next_button_selector
        )
        
        automation_thread = threading.Thread(target=self.automation.run)
        automation_thread.daemon = True
        automation_thread.start()
        
        logging.info(f"Automação iniciada conectando na porta: {port}")
    
    def toggle_pause(self):
        if self.automation:
            self.automation.toggle_pause()
            pause_status = "Pausar" if not self.automation.paused else "Continuar"
            self.pause_button.config(text=pause_status)
    
    def stop_automation(self):
        if self.automation:
            self.automation.stop()
            # Resetar botões
            self.start_button.config(state=tk.NORMAL)
            self.pause_button.config(state=tk.DISABLED, text="Pausar")
            self.stop_button.config(state=tk.DISABLED)
            logging.info("Automação interrompida")
    
    def __del__(self):
        # Garantir que o processo do Chrome seja encerrado quando a aplicação for fechada
        if hasattr(self, 'chrome_process') and self.chrome_process:
            try:
                self.chrome_process.terminate()
            except:
                pass

class LogHandler(logging.Handler):
    def __init__(self, text_widget):
        logging.Handler.__init__(self)
        self.text_widget = text_widget
    
    def emit(self, record):
        msg = self.format(record) + '\n'
        self.text_widget.configure(state='normal')
        self.text_widget.insert(tk.END, msg)
        self.text_widget.see(tk.END)
        self.text_widget.configure(state='disabled')

class WebQuizAutomation:
    def __init__(self, port, question_selector, options_selector, next_button_selector):
        self.port = port
        self.question_selector = question_selector
        self.options_selector = options_selector
        self.next_button_selector = next_button_selector
        self.running = False
        self.paused = False
        self.current_question = 0
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        self.driver = None
    
    def toggle_pause(self):
        self.paused = not self.paused
        status = "pausada" if self.paused else "retomada"
        logging.info(f"Automação {status}")
    
    def stop(self):
        self.running = False
        # Não fechamos o navegador, pois ele foi aberto pelo usuário
        logging.info("Automação interrompida")
    
    def get_ai_answer(self, question, options):
        """Consulta a IA para obter a resposta para a pergunta com validação dupla"""
        try:
            prompt = f"""Pergunta: {question}\n\nOpções:\n{options}\n\nQual é a resposta correta? Responda apenas com a letra da opção (A, B, C, D, etc.) ou o texto exato da opção correta."""
            
            # Primeira consulta
            response1 = self.model.generate_content(prompt)
            answer1 = response1.text.strip()
            logging.info(f"Primeira resposta da IA: {answer1}")
            
            # Segunda consulta para validação
            response2 = self.model.generate_content(prompt)
            answer2 = response2.text.strip()
            logging.info(f"Segunda resposta da IA: {answer2}")
            
            # Verificar se as respostas são iguais
            if answer1 == answer2:
                logging.info("As duas respostas da IA são idênticas, usando esta resposta.")
                return answer1
            
            # Se as respostas forem diferentes, pedir uma reavaliação
            reevaluation_prompt = f"""Pergunta: {question}\n\nOpções:\n{options}\n\nVocê deu duas respostas diferentes para esta pergunta:\nResposta 1: {answer1}\nResposta 2: {answer2}\n\nPor favor, reavalie cuidadosamente e forneça a resposta correta com pelo menos 80% de certeza. Responda apenas com a letra da opção (A, B, C, D, etc.) ou o texto exato da opção correta."""
            
            response3 = self.model.generate_content(reevaluation_prompt)
            answer3 = response3.text.strip()
            logging.info(f"Resposta final após reavaliação: {answer3}")
            return answer3
        except Exception as e:
            logging.error(f"Erro ao consultar IA: {e}")
            return ""
    
    def select_answer(self, answer, options_elements):
        """Seleciona a resposta na interface"""
        try:
            # Se a resposta for uma letra (A, B, C, D...)
            if len(answer) == 1 and answer.isalpha():
                option_index = ord(answer.upper()[0]) - ord('A')
                if 0 <= option_index < len(options_elements):
                    options_elements[option_index].click()
                    logging.info(f"Clicou na opção {answer}")
                    return True
                logging.warning(f"Índice de opção {option_index} fora do intervalo válido (0-{len(options_elements)-1})")
            else:
                # Se a resposta for o texto completo da opção
                for option in options_elements:
                    # Obter o texto da opção usando uma função auxiliar para reduzir duplicação
                    option_text = self._get_option_text(option)
                    
                    if answer.lower() in option_text.lower():
                        option.click()
                        logging.info(f"Clicou na opção com texto: {option_text}")
                        return True
            
            # Se não encontrou a opção específica, clique na primeira opção
            if options_elements:
                options_elements[0].click()
                logging.info("Não foi possível encontrar a opção exata. Clicou na primeira opção.")
                return True
            
            return False
        except Exception as e:
            logging.error(f"Erro ao selecionar resposta: {e}")
            return False
    
    def _get_option_text(self, option):
        """Função auxiliar para obter o texto de uma opção"""
        try:
            # Tentar obter o texto do label associado
            option_id = option.get_attribute("id")
            if option_id:
                try:
                    label = self.driver.find_element(By.CSS_SELECTOR, f"label[for='{option_id}']")
                    return label.text
                except NoSuchElementException:
                    pass
            
            # Se não tiver id ou não encontrar o label, tentar obter o texto do elemento pai
            try:
                parent = option.find_element(By.XPATH, "..")
                return parent.text
            except NoSuchElementException:
                pass
            
            # Se falhar, usar o valor do elemento
            return option.get_attribute("value") or ""
        except Exception:
            return ""
    
    def click_next_button(self):
        """Clica no botão 'PRÓXIMA PÁGINA'"""
        try:
            # Lista de seletores para tentar encontrar o botão
            selectors = [
                self.next_button_selector,  # Seletor fornecido pelo usuário
                "input[value='Próxima página']",  # Input com valor exato
                "input.mod_quiz-next-nav",        # Input com classe específica
                ".mod_quiz-next-nav",             # Qualquer elemento com a classe específica
                "input[type='submit'][name='next']", # Input do tipo submit com name="next"
                "input[type='submit'][value*='próxima']", # Input com valor contendo 'próxima' (case insensitive)
                "input[type='submit'][value*='Próxima']", # Input com valor contendo 'Próxima'
                "[id*='next']",                   # Qualquer elemento com id contendo 'next'
                "[id*='nextpage']",               # Qualquer elemento com id contendo 'nextpage'
                "[class*='next']",                # Qualquer elemento com classe contendo 'next'
                "[aria-label*='próxima']",        # Elementos com aria-label contendo 'próxima'
                "[aria-label*='Próxima']",        # Elementos com aria-label contendo 'Próxima'
                "form input[type='submit']:last-of-type" # Último botão de submit em um formulário
            ]
            
            # Tentar cada seletor
            for selector in selectors:
                try:
                    # Usar espera explícita para garantir que o elemento está clicável
                    wait = WebDriverWait(self.driver, 5)
                    next_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, selector)))
                    next_button.click()
                    logging.info(f"Clicou no botão 'PRÓXIMA PÁGINA' usando seletor: {selector}")
                    return True
                except Exception:
                    continue  # Tentar o próximo seletor
            
            # Se ainda não encontrou, tentar com XPath
            xpath_selectors = [
                "//input[@value='Próxima página']",
                "//input[contains(@value, 'Próxima')]",
                "//input[@name='next']",
                "//button[contains(text(), 'Próxima')]",
                "//a[contains(text(), 'Próxima')]",
                "//input[@type='submit'][last()]"
            ]
            
            for xpath in xpath_selectors:
                try:
                    next_button = self.driver.find_element(By.XPATH, xpath)
                    next_button.click()
                    logging.info(f"Clicou no botão 'PRÓXIMA PÁGINA' usando XPath: {xpath}")
                    return True
                except Exception:
                    continue
            
            # Se ainda não encontrou, tentar com JavaScript
            try:
                self.driver.execute_script("""
                    // Tentar encontrar o botão por texto
                    var buttons = document.querySelectorAll('input[type="submit"], button');
                    for (var i = 0; i < buttons.length; i++) {
                        var btn = buttons[i];
                        if (btn.value && (btn.value.includes('Próxima') || btn.value.includes('próxima'))) {
                            btn.click();
                            return true;
                        }
                        if (btn.textContent && (btn.textContent.includes('Próxima') || btn.textContent.includes('próxima'))) {
                            btn.click();
                            return true;
                        }
                    }
                    
                    // Se não encontrou, clicar no último botão de submit do formulário
                    var forms = document.querySelectorAll('form');
                    for (var i = 0; i < forms.length; i++) {
                        var submits = forms[i].querySelectorAll('input[type="submit"]');
                        if (submits.length > 0) {
                            submits[submits.length - 1].click();
                            return true;
                        }
                    }
                    
                    return false;
                """)
                logging.info("Tentativa de clicar no botão 'PRÓXIMA PÁGINA' usando JavaScript")
                return True
            except Exception as js_error:
                logging.error(f"Erro ao tentar clicar com JavaScript: {js_error}")
            
            logging.warning("Botão 'PRÓXIMA PÁGINA' não encontrado após tentar múltiplos métodos")
            return False
        except Exception as e:
            logging.error(f"Erro ao clicar no botão 'PRÓXIMA PÁGINA': {e}")
            return False
    
    def process_question(self):
        """Processa uma pergunta do quiz"""
        try:
            # Esperar pelo carregamento da página
            time.sleep(2)  # Dar tempo para a página carregar completamente
            
            # Extrair a pergunta
            question_text = self._extract_question()
            if not question_text:
                return False
            
            # Extrair as opções
            options_elements, options_text = self._extract_options()
            if not options_elements:
                return False
            
            # Obter resposta da IA com validação dupla
            answer = self.get_ai_answer(question_text, options_text)
            if not answer:
                logging.warning("Não foi possível obter uma resposta da IA")
                return False
            
            logging.info(f"Resposta selecionada com confiança mínima de 80%: {answer}")
            
            # Selecionar a resposta
            if not self.select_answer(answer, options_elements):
                logging.warning("Não foi possível selecionar a resposta")
                return False
            
            # Aguardar um pouco para garantir que a resposta foi registrada
            time.sleep(1)
            
            # Clicar no botão de próxima página
            if not self.click_next_button():
                logging.warning("Não foi possível avançar para a próxima página")
                return False
            
            self.current_question += 1
            logging.info(f"Pergunta {self.current_question} processada com sucesso")
            return True
        
        except Exception as e:
            logging.error(f"Erro ao processar pergunta: {e}")
            return False
    
    def _extract_question(self):
        """Extrai o texto da pergunta da página"""
        try:
            question_element = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, self.question_selector))
            )
            question_text = question_element.text
            logging.info(f"Pergunta detectada: {question_text[:100]}...")
            return question_text
        except Exception as e:
            logging.warning(f"Elemento de pergunta não encontrado: {e}")
            # Tentar encontrar a pergunta com outros seletores
            alternative_selectors = [".qtext", ".question-text", ".questiontext", "#question"]
            for selector in alternative_selectors:
                try:
                    question_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    question_text = question_element.text
                    logging.info(f"Pergunta detectada com seletor alternativo {selector}: {question_text[:100]}...")
                    return question_text
                except:
                    continue
            
            # Se não encontrou com nenhum seletor, usar o texto da página
            logging.warning("Não foi possível extrair a pergunta específica. Analisando toda a página.")
            return "Não foi possível extrair a pergunta específica. Analisando toda a página."
    
    def _extract_options(self):
        """Extrai as opções de resposta da página"""
        try:
            options_elements = WebDriverWait(self.driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, self.options_selector))
            )
            
            # Obter o texto das opções
            options_text = ""
            for i, option in enumerate(options_elements):
                option_text = self._get_option_text(option) or f"Opção {i+1}"
                options_text += f"{chr(65+i)}) {option_text}\n"
            
            logging.info(f"Opções detectadas:\n{options_text}")
            return options_elements, options_text
        except Exception as e:
            logging.warning(f"Elementos de opções não encontrados: {e}")
            # Tentar encontrar as opções com outros seletores
            alternative_selectors = [
                "input[type='radio']", 
                ".answer input", 
                ".option", 
                ".answer",
                "label"
            ]
            for selector in alternative_selectors:
                try:
                    options_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if options_elements:
                        options_text = ""
                        for i, option in enumerate(options_elements):
                            option_text = self._get_option_text(option) or f"Opção {i+1}"
                            options_text += f"{chr(65+i)}) {option_text}\n"
                        logging.info(f"Opções encontradas com seletor alternativo: {selector}")
                        return options_elements, options_text
                except:
                    continue
            
            logging.error("Não foi possível encontrar as opções de resposta")
            return None, ""
    
    def run(self):
        """Executa a automação do quiz"""
        self.running = True
        self.paused = False
        
        try:
            # Configurar o driver do Selenium para conectar a uma instância existente do Chrome
            chrome_options = webdriver.ChromeOptions()
            chrome_options.add_experimental_option("debuggerAddress", f"localhost:{self.port}")
            
            # Conectar ao navegador existente
            try:
                self.driver = webdriver.Chrome(options=chrome_options)
                logging.info(f"Conectado com sucesso ao Chrome na porta {self.port}")
            except Exception as e:
                logging.error(f"Erro ao conectar ao Chrome: {e}")
                logging.error("Certifique-se de que o Chrome está aberto com a flag --remote-debugging-port={self.port}")
                self.running = False
                return
            
            # Obter a URL atual
            current_url = self.driver.current_url
            logging.info(f"Página atual: {current_url}")
            
            # Loop principal da automação
            while self.running:
                # Verificar se está pausado
                if self.paused:
                    time.sleep(1)
                    continue
                
                # Processar a pergunta atual
                success = self.process_question()
                
                if not success:
                    logging.warning("Falha ao processar pergunta, tentando novamente em 5 segundos...")
                    time.sleep(5)
                else:
                    # Aguardar um pouco antes de processar a próxima pergunta
                    time.sleep(2)
            
            # Não fechamos o navegador, pois ele foi aberto pelo usuário
            logging.info("Automação finalizada")
        
        except Exception as e:
            logging.error(f"Erro na automação: {e}")
            self.running = False

def main():
    # Criar a janela principal do Tkinter
    root = tk.Tk()
    app = WebQuizAutomationGUI(root)
    
    # Executar o loop do Tkinter
    root.mainloop()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logging.error(f"Erro ao iniciar aplicação: {e}")