# MPM AutoIA - Automação de Quiz Web

Este projeto implementa uma automação para Windows que responde perguntas em uma página web utilizando inteligência artificial (Google Gemini). A solução utiliza o Selenium WebDriver para se conectar a uma instância do Chrome já aberta pelo usuário, resolvendo problemas de autenticação e mantendo a sessão existente.

## Funcionalidades

- Conecta-se a uma instância do Chrome já autenticada no site
- Identifica perguntas e opções de resposta usando seletores CSS
- Consulta o Google Gemini com validação dupla para obter respostas mais precisas
- Seleciona automaticamente a resposta na interface
- Avança para a próxima página/pergunta
- Interface gráfica moderna com tema escuro e amarelo
- Sistema de logs para acompanhamento do progresso

## Requisitos

- Windows 10 ou superior
- Python 3.7 ou superior
- Google Chrome instalado

## Instalação

1. Instale as dependências Python:
   ```
   pip install -r requirements.txt
   ```

## Como usar

### Preparando o Chrome

1. Feche todas as instâncias do Chrome em execução

2. Na interface do MPM AutoIA, configure o caminho do Chrome e a porta de depuração (padrão: 9222)

3. Clique em "Iniciar Chrome em Modo Depuração"

4. Navegue até o site do quiz e faça login normalmente

5. Deixe o navegador aberto na página do quiz que você deseja automatizar

### Executando a Automação

1. Na interface, ajuste os seletores se necessário:
   - **Seletor da pergunta**: `.qtext` (padrão)
   - **Seletor das opções**: `input[type='radio']` (padrão)
   - **Seletor do botão próxima**: `input[value='Próxima página']` (padrão)

2. Clique em "Iniciar Automação" para começar

3. Use os botões "Pausar" e "Parar" para controlar a automação

## Personalização

Você pode ajustar os seguintes parâmetros no código para melhorar o desempenho em diferentes cenários:

- Seletores CSS para identificar elementos na página
- Tempo de espera entre ações (`time.sleep`)
- Prompt enviado para a IA (`get_ai_answer`)

## Solução de problemas

1. **Erro de Conexão**: Certifique-se de que o Chrome está em execução com a flag de depuração remota correta

2. **Porta Incorreta**: Verifique se a porta especificada na interface corresponde à porta usada ao iniciar o Chrome

3. **Seletores Incorretos**: Ajuste os seletores na interface conforme necessário para o site específico

## Limitações

1. O Chrome deve ser iniciado através da interface do MPM AutoIA antes de executar a automação

2. Por razões de segurança, o Chrome exibirá uma barra de notificação indicando que está sendo controlado por software de teste

3. Não é recomendado usar o mesmo perfil do Chrome para navegação normal enquanto a automação está em execução