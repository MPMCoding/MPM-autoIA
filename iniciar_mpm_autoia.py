import os
import sys
import subprocess
import tkinter as tk
from tkinter import ttk, messagebox

# Configuração da janela de seleção
root = tk.Tk()
root.title("MPM AutoIA - Seleção de Interface")
root.geometry("500x300")
root.configure(bg="#f0f5ff")
root.resizable(False, False)

# Estilo para os widgets
style = ttk.Style()
style.configure("TFrame", background="#f0f5ff")
style.configure("TLabel", background="#f0f5ff", foreground="#1a1a1a", font=("Segoe UI", 10))
style.configure("Header.TLabel", font=("Segoe UI", 16, "bold"), foreground="#1a56db")
style.configure("TButton", font=("Segoe UI", 10, "bold"))

# Frame principal
main_frame = ttk.Frame(root)
main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

# Título
title_label = ttk.Label(main_frame, text="MPM AutoIA - Assistente de Aprendizagem", style="Header.TLabel")
title_label.pack(pady=(0, 20))

# Descrição
desc_label = ttk.Label(main_frame, text="Escolha qual interface você deseja utilizar:", font=("Segoe UI", 11))
desc_label.pack(pady=(0, 20))

# Função para iniciar a interface moderna
def iniciar_interface_moderna():
    try:
        # Verificar se o PyQt5 está instalado
        import PyQt5
        # Iniciar a interface moderna
        subprocess.Popen([sys.executable, "mpm_autoia_interface.py"])
        root.destroy()
    except ImportError:
        # Se PyQt5 não estiver instalado, perguntar se deseja instalar
        resposta = messagebox.askyesno(
            "Dependências Necessárias",
            "A interface moderna requer PyQt5, que não está instalado.\n\nDeseja instalar agora?"
        )
        if resposta:
            # Instalar dependências
            messagebox.showinfo(
                "Instalando Dependências",
                "Aguarde enquanto instalamos as dependências necessárias.\n\nIsso pode levar alguns minutos."
            )
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements_interface.txt"])
                messagebox.showinfo("Sucesso", "Dependências instaladas com sucesso! Iniciando a interface moderna...")
                subprocess.Popen([sys.executable, "mpm_autoia_interface.py"])
                root.destroy()
            except Exception as e:
                messagebox.showerror("Erro", f"Erro ao instalar dependências: {e}\n\nTente instalar manualmente com:\npip install -r requirements_interface.txt")

# Função para iniciar a interface original
def iniciar_interface_original():
    subprocess.Popen([sys.executable, "web_quiz_automation.py"])
    root.destroy()

# Frame para os botões
buttons_frame = ttk.Frame(main_frame)
buttons_frame.pack(pady=20)

# Botão para interface moderna
moderna_button = tk.Button(
    buttons_frame, 
    text="Interface Moderna (PyQt5)", 
    font=("Segoe UI", 11, "bold"),
    bg="#1a56db", 
    fg="white",
    padx=20,
    pady=10,
    cursor="hand2",
    command=iniciar_interface_moderna
)
moderna_button.pack(pady=(0, 10))

# Descrição da interface moderna
moderna_desc = ttk.Label(buttons_frame, text="Design elegante e moderno com visual aprimorado", font=("Segoe UI", 9), foreground="#6b7280")
moderna_desc.pack(pady=(0, 15))

# Botão para interface original
original_button = tk.Button(
    buttons_frame, 
    text="Interface Original (Tkinter)", 
    font=("Segoe UI", 11),
    bg="#3b82f6", 
    fg="white",
    padx=20,
    pady=10,
    cursor="hand2",
    command=iniciar_interface_original
)
original_button.pack()

# Descrição da interface original
original_desc = ttk.Label(buttons_frame, text="Interface tradicional com todas as funcionalidades", font=("Segoe UI", 9), foreground="#6b7280")
original_desc.pack()

# Rodapé
footer_label = ttk.Label(main_frame, text="MPM AutoIA v1.0", font=("Segoe UI", 8), foreground="#6b7280")
footer_label.pack(side=tk.BOTTOM, pady=(20, 0))

# Iniciar a aplicação
root.mainloop()