import os
import sys
import subprocess
import logging
import threading
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QLineEdit, QFrame, QFileDialog, QMessageBox,
                             QSpacerItem, QSizePolicy, QComboBox, QCheckBox, QGroupBox)
from PyQt5.QtGui import QIcon, QFont, QPixmap, QPainter, QPainterPath, QColor, QBrush, QPen
from PyQt5.QtCore import Qt, QSize, QRect, QPoint, QPropertyAnimation, QEasingCurve, pyqtSignal, QThread
from PyQt5.QtSvg import QSvgRenderer

# Importar o módulo de automação
import web_quiz_automation as automation

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("automation.log"),
        logging.StreamHandler()
    ]
)

# Logo SVG do MPM AutoIA (mesmo do web_quiz_automation.py)
MPM_LOGO_SVG = '''
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
'''

# Definição de cores da interface (seguindo o estilo do codigoexemplo.html)
COLORS = {
    'primary_blue': '#1a56db',
    'secondary_blue': '#3b82f6',
    'light_blue': '#e1effe',
    'background': '#f0f5ff',
    'white': '#ffffff',
    'text_dark': '#1a1a1a',
    'text_gray': '#6b7280',
    'hover_primary': '#1e429f',
    'hover_secondary': '#2563eb',
    'shadow': '#dbeafe'
}

# Classe para criar cards com sombra e bordas arredondadas
class CardWidget(QFrame):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("card")
        self.setStyleSheet("""
            #card {
                background-color: #ffffff;
                border-radius: 8px;
                border: 1px solid #e1effe;
            }
        """)
        self.setContentsMargins(15, 15, 15, 15)
        
        # Efeito de sombra
        self.setGraphicsEffect(self.create_shadow_effect())
        
    def create_shadow_effect(self):
        from PyQt5.QtWidgets import QGraphicsDropShadowEffect
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(15)
        shadow.setColor(QColor(COLORS['shadow']))
        shadow.setOffset(0, 3)
        return shadow

# Classe para botões estilizados
class StyledButton(QPushButton):
    def __init__(self, text, is_primary=True, parent=None):
        super().__init__(text, parent)
        self.is_primary = is_primary
        self.setFont(QFont("Segoe UI", 10, QFont.Bold))
        self.setCursor(Qt.PointingHandCursor)
        self.setMinimumHeight(36)
        self.update_style()
        
    def update_style(self):
        if self.is_primary:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: {COLORS['primary_blue']};
                    color: {COLORS['white']};
                    border-radius: 6px;
                    padding: 8px 16px;
                    border: none;
                }}
                QPushButton:hover {{
                    background-color: {COLORS['hover_primary']};
                }}
                QPushButton:disabled {{
                    background-color: {COLORS['text_gray']};
                }}
            """)
        else:
            self.setStyleSheet(f"""
                QPushButton {{
                    background-color: {COLORS['secondary_blue']};
                    color: {COLORS['white']};
                    border-radius: 6px;
                    padding: 8px 16px;
                    border: none;
                }}
                QPushButton:hover {{
                    background-color: {COLORS['hover_secondary']};
                }}
                QPushButton:disabled {{
                    background-color: {COLORS['text_gray']};
                }}
            """)

# Classe para campos de entrada estilizados
class StyledLineEdit(QLineEdit):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setStyleSheet(f"""
            QLineEdit {{
                background-color: {COLORS['white']};
                border: 1px solid {COLORS['light_blue']};
                border-radius: 4px;
                padding: 8px;
                color: {COLORS['text_dark']};
            }}
            QLineEdit:focus {{
                border: 1px solid {COLORS['secondary_blue']};
            }}
        """)
        self.setMinimumHeight(36)

# Classe para rótulos de título
class HeaderLabel(QLabel):
    def __init__(self, text, level=1, parent=None):
        super().__init__(text, parent)
        if level == 1:
            self.setFont(QFont("Segoe UI", 18, QFont.Bold))
            self.setStyleSheet(f"color: {COLORS['primary_blue']};")
        elif level == 2:
            self.setFont(QFont("Segoe UI", 14, QFont.Bold))
            self.setStyleSheet(f"color: {COLORS['primary_blue']};")
        else:
            self.setFont(QFont("Segoe UI", 12, QFont.Bold))
            self.setStyleSheet(f"color: {COLORS['primary_blue']};")

# Thread para executar a automação em segundo plano
class AutomationThread(QThread):
    status_update = pyqtSignal(str)
    finished = pyqtSignal()
    error = pyqtSignal(str)
    
    def __init__(self, port, question_selector, options_selector, next_button_selector):
        super().__init__()
        self.port = port
        self.question_selector = question_selector
        self.options_selector = options_selector
        self.next_button_selector = next_button_selector
        self.running = True
        self.paused = False
        self.automation = None
    
    def run(self):
        try:
            self.status_update.emit("Iniciando automação...")
            # Criar instância da automação
            self.automation = automation.WebQuizAutomation(
                port=self.port,
                question_selector=self.question_selector,
                options_selector=self.options_selector,
                next_button_selector=self.next_button_selector
            )
            # Executar a automação
            self.automation.run()
            self.finished.emit()
        except Exception as e:
            self.error.emit(str(e))
            logging.error(f"Erro na thread de automação: {e}")
    
    def stop(self):
        if self.automation:
            self.automation.stop()
        self.running = False
        self.wait()
    
    def toggle_pause(self):
        if self.automation:
            self.automation.toggle_pause()
            self.paused = self.automation.paused

# Classe principal da interface
class MPMAutoIAApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("MPM AutoIA - Assistente de Aprendizagem")
        self.setMinimumSize(800, 600)
        self.setStyleSheet(f"background-color: {COLORS['background']};")
        
        # Variáveis de estado
        self.chrome_process = None
        self.chrome_path = self.find_chrome_path()
        self.user_data_dir = os.path.join(os.environ['TEMP'], "chrome_debug_profile")
        self.automation_thread = None
        
        # Configurar a interface
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
        # Widget central
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Layout principal
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)
        
        # Card principal
        main_card = CardWidget()
        main_layout.addWidget(main_card)
        
        # Layout do card principal
        card_layout = QVBoxLayout(main_card)
        card_layout.setSpacing(15)
        
        # Cabeçalho com logo e título
        header_layout = QHBoxLayout()
        
        # Logo SVG
        logo_label = QLabel()
        renderer = QSvgRenderer()
        renderer.load(bytearray(MPM_LOGO_SVG, encoding='utf-8'))
        pixmap = QPixmap(120, 120)
        pixmap.fill(Qt.transparent)
        painter = QPainter(pixmap)
        renderer.render(painter)
        painter.end()
        logo_label.setPixmap(pixmap)
        header_layout.addWidget(logo_label)
        
        # Título e subtítulo
        title_layout = QVBoxLayout()
        title = HeaderLabel("MPM AutoIA")
        subtitle = HeaderLabel("Automação Inteligente de Quiz Web", level=2)
        title_layout.addWidget(title)
        title_layout.addWidget(subtitle)
        title_layout.addStretch()
        
        header_layout.addLayout(title_layout)
        header_layout.addStretch(1)
        
        card_layout.addLayout(header_layout)
        
        # Separador
        separator1 = QFrame()
        separator1.setFrameShape(QFrame.HLine)
        separator1.setFrameShadow(QFrame.Sunken)
        separator1.setStyleSheet(f"background-color: {COLORS['light_blue']};")
        card_layout.addWidget(separator1)
        
        # Seção de configuração do Chrome
        chrome_card = CardWidget()
        chrome_layout = QVBoxLayout(chrome_card)
        
        chrome_title = HeaderLabel("Configuração do Chrome", level=2)
        chrome_layout.addWidget(chrome_title)
        
        # Caminho do Chrome
        chrome_path_layout = QHBoxLayout()
        chrome_path_label = QLabel("Caminho do Chrome:")
        chrome_path_label.setMinimumWidth(150)
        self.chrome_path_input = StyledLineEdit()
        if self.chrome_path:
            self.chrome_path_input.setText(self.chrome_path)
        browse_button = StyledButton("Procurar", is_primary=False)
        browse_button.clicked.connect(self.browse_chrome)
        
        chrome_path_layout.addWidget(chrome_path_label)
        chrome_path_layout.addWidget(self.chrome_path_input)
        chrome_path_layout.addWidget(browse_button)
        
        chrome_layout.addLayout(chrome_path_layout)
        
        # Porta de depuração
        port_layout = QHBoxLayout()
        port_label = QLabel("Porta de depuração:")
        port_label.setMinimumWidth(150)
        self.port_input = StyledLineEdit()
        self.port_input.setText("9222")
        self.port_input.setMaximumWidth(100)
        
        port_layout.addWidget(port_label)
        port_layout.addWidget(self.port_input)
        port_layout.addStretch(1)
        
        chrome_layout.addLayout(port_layout)
        
        # Botão para iniciar o Chrome
        chrome_button_layout = QHBoxLayout()
        self.start_chrome_button = StyledButton("Iniciar Chrome em Modo Depuração")
        self.start_chrome_button.clicked.connect(self.start_chrome)
        self.chrome_status_label = QLabel("Chrome não iniciado")
        self.chrome_status_label.setStyleSheet(f"color: {COLORS['text_gray']};")
        
        chrome_button_layout.addWidget(self.start_chrome_button)
        chrome_button_layout.addWidget(self.chrome_status_label)
        chrome_button_layout.addStretch(1)
        
        chrome_layout.addLayout(chrome_button_layout)
        card_layout.addWidget(chrome_card)
        
        # Separador
        separator2 = QFrame()
        separator2.setFrameShape(QFrame.HLine)
        separator2.setFrameShadow(QFrame.Sunken)
        separator2.setStyleSheet(f"background-color: {COLORS['light_blue']};")
        card_layout.addWidget(separator2)
        
        # Seção de configuração dos seletores
        selectors_card = CardWidget()
        selectors_layout = QVBoxLayout(selectors_card)
        
        selectors_title = HeaderLabel("Configuração dos Seletores CSS", level=2)
        selectors_layout.addWidget(selectors_title)
        
        # Seletor de pergunta
        question_layout = QHBoxLayout()
        question_label = QLabel("Seletor da pergunta:")
        question_label.setMinimumWidth(150)
        self.question_selector = StyledLineEdit()
        self.question_selector.setText(".qtext")
        
        question_layout.addWidget(question_label)
        question_layout.addWidget(self.question_selector)
        
        selectors_layout.addLayout(question_layout)
        
        # Seletor de opções
        options_layout = QHBoxLayout()
        options_label = QLabel("Seletor das opções:")
        options_label.setMinimumWidth(150)
        self.options_selector = StyledLineEdit()
        self.options_selector.setText("input[type='radio']")
        
        options_layout.addWidget(options_label)
        options_layout.addWidget(self.options_selector)
        
        selectors_layout.addLayout(options_layout)
        
        # Seletor do botão próxima
        next_button_layout = QHBoxLayout()
        next_button_label = QLabel("Seletor do botão próxima:")
        next_button_label.setMinimumWidth(150)
        self.next_button_selector = StyledLineEdit()
        self.next_button_selector.setText("input[value='Próxima página']")
        
        next_button_layout.addWidget(next_button_label)
        next_button_layout.addWidget(self.next_button_selector)
        
        selectors_layout.addLayout(next_button_layout)
        card_layout.addWidget(selectors_card)
        
        # Separador
        separator3 = QFrame()
        separator3.setFrameShape(QFrame.HLine)
        separator3.setFrameShadow(QFrame.Sunken)
        separator3.setStyleSheet(f"background-color: {COLORS['light_blue']};")
        card_layout.addWidget(separator3)
        
        # Seção de controles da automação
        controls_card = CardWidget()
        controls_layout = QVBoxLayout(controls_card)
        
        controls_title = HeaderLabel("Controles da Automação", level=2)
        controls_layout.addWidget(controls_title)
        
        # Botões de controle
        buttons_layout = QHBoxLayout()
        self.start_button = StyledButton("Iniciar Automação")
        self.start_button.clicked.connect(self.start_automation)
        
        self.pause_button = StyledButton("Pausar", is_primary=False)
        self.pause_button.clicked.connect(self.toggle_pause)
        self.pause_button.setEnabled(False)
        
        self.stop_button = StyledButton("Parar", is_primary=False)
        self.stop_button.clicked.connect(self.stop_automation)
        self.stop_button.setEnabled(False)
        
        buttons_layout.addWidget(self.start_button)
        buttons_layout.addWidget(self.pause_button)
        buttons_layout.addWidget(self.stop_button)
        buttons_layout.addStretch(1)
        
        controls_layout.addLayout(buttons_layout)
        
        # Status da automação
        status_layout = QHBoxLayout()
        self.status_label = QLabel("Pronto para iniciar")
        self.status_label.setStyleSheet(f"color: {COLORS['text_gray']};")
        status_layout.addWidget(self.status_label)
        status_layout.addStretch(1)
        
        controls_layout.addLayout(status_layout)
        card_layout.addWidget(controls_card)
        
        # Rodapé
        footer_layout = QHBoxLayout()
        footer_label = QLabel("MPM AutoIA v1.0 - Pronto para uso")
        footer_label.setStyleSheet(f"color: {COLORS['text_gray']};")
        footer_layout.addStretch(1)
        footer_layout.addWidget(footer_label)
        
        card_layout.addLayout(footer_layout)
    
    def browse_chrome(self):
        """Abre um diálogo para selecionar o executável do Chrome"""
        chrome_path, _ = QFileDialog.getOpenFileName(
            self,
            "Selecione o executável do Chrome",
            os.environ.get('PROGRAMFILES', ''),
            "Executáveis (*.exe)"
        )
        if chrome_path:
            self.chrome_path_input.setText(chrome_path)
            self.chrome_path = chrome_path
    
    def start_chrome(self):
        """Inicia o Chrome em modo de depuração remota"""
        try:
            # Obter o caminho do Chrome e a porta
            chrome_path = self.chrome_path_input.text()
            port = self.port_input.text()
            
            if not chrome_path or not os.path.exists(chrome_path):
                QMessageBox.critical(self, "MPM AutoIA - Erro", "Caminho do Chrome inválido. Por favor, selecione o executável correto.")
                return
            
            if not port.isdigit():
                QMessageBox.critical(self, "MPM AutoIA - Erro", "Porta inválida. Por favor, insira um número de porta válido.")
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
            self.chrome_status_label.setText(f"Chrome iniciado na porta {port}")
            self.start_chrome_button.setEnabled(False)
            
            logging.info(f"Chrome iniciado em modo de depuração na porta {port}")
            
            # Mostrar mensagem
            QMessageBox.information(self, "MPM AutoIA", f"Chrome iniciado em modo de depuração na porta {port}")
            
        except Exception as e:
            logging.error(f"Erro ao iniciar o Chrome: {e}")
            QMessageBox.critical(self, "MPM AutoIA - Erro", f"Falha ao iniciar o Chrome: {e}")
    
    def start_automation(self):
        """Inicia a automação do quiz"""
        port = self.port_input.text()
        question_selector = self.question_selector.text()
        options_selector = self.options_selector.text()
        next_button_selector = self.next_button_selector.text()
        
        if not port.isdigit():
            QMessageBox.critical(self, "MPM AutoIA - Erro", "Porta inválida. Por favor, insira um número de porta válido.")
            return
        
        # Desabilitar botão de iniciar e habilitar botões de controle
        self.start_button.setEnabled(False)
        self.pause_button.setEnabled(True)
        self.stop_button.setEnabled(True)
        
        # Iniciar a automação em uma thread separada
        self.automation_thread = AutomationThread(
            port=port,
            question_selector=question_selector,
            options_selector=options_selector,
            next_button_selector=next_button_selector
        )
        
        # Conectar sinais
        self.automation_thread.status_update.connect(self.update_status)
        self.automation_thread.finished.connect(self.automation_finished)
        self.automation_thread.error.connect(self.automation_error)
        
        # Iniciar a thread
        self.automation_thread.start()
        
        self.status_label.setText(f"Automação iniciada conectando na porta: {port}")
        logging.info(f"Automação iniciada conectando na porta: {port}")
    
    def update_status(self, message):
        """Atualiza o status da automação"""
        self.status_label.setText(message)
        logging.info(message)
    
    def automation_finished(self):
        """Chamado quando a automação termina"""
        self.start_button.setEnabled(True)
        self.pause_button.setEnabled(False)
        self.stop_button.setEnabled(False)
        self.status_label.setText("Automação concluída")
        logging.info("Automação concluída")
    
    def automation_error(self, error_message):
        """Chamado quando ocorre um erro na automação"""
        QMessageBox.critical(self, "MPM AutoIA - Erro", f"Erro na automação: {error_message}")
        self.start_button.setEnabled(True)
        self.pause_button.setEnabled(False)
        self.stop_button.setEnabled(False)
        self.status_label.setText(f"Erro: {error_message}")
        logging.error(f"Erro na automação: {error_message}")
    
    def toggle_pause(self):
        """Pausa ou continua a automação"""
        if self.automation_thread:
            self.automation_thread.toggle_pause()
            pause_status = "Pausar" if not self.automation_thread.paused else "Continuar"
            self.pause_button.setText(pause_status)
            status_text = "Automação pausada" if self.automation_thread.paused else "Automação continuando"
            self.status_label.setText(status_text)
            logging.info(status_text)
    
    def stop_automation(self):
        """Para a automação"""
        if self.automation_thread:
            self.automation_thread.stop()
            # Resetar botões
            self.start_button.setEnabled(True)
            self.pause_button.setEnabled(False)
            self.pause_button.setText("Pausar")
            self.stop_button.setEnabled(False)
            self.status_label.setText("Automação interrompida")
            logging.info("Automação interrompida")
    
    def closeEvent(self, event):
        """Manipula o evento de fechamento da janela"""
        # Parar a automação se estiver em execução
        if self.automation_thread and self.automation_thread.isRunning():
            self.automation_thread.stop()
        
        # Encerrar o Chrome se estiver em execução
        if self.chrome_process:
            try:
                self.chrome_process.terminate()
            except:
                pass
        
        event.accept()

# Ponto de entrada principal do programa
if __name__ == "__main__":
    try:
        app = QApplication(sys.argv)
        window = MPMAutoIAApp()
        window.show()
        sys.exit(app.exec_())
    except Exception as e:
        logging.error(f"Erro ao iniciar a aplicação: {e}")
        print(f"Erro ao iniciar a aplicação: {e}")
        import traceback
        traceback.print_exc()