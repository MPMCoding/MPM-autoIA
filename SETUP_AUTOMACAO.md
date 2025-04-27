# Configuração da Automação MPM-autoIA

Este guia contém instruções detalhadas para configurar corretamente o ambiente de automação do MPM-autoIA.

## Requisitos

- Python 3.8 ou superior
- Google Chrome instalado
- Conexão com a internet

## Instalação das Dependências

Execute o seguinte comando para instalar todas as dependências necessárias:

```bash
pip install selenium webdriver-manager pillow google-generativeai --upgrade
```

## Configuração do Navegador Embutido

A automação agora utiliza o navegador embutido da aplicação, o que permite:

1. Aproveitar a sessão de autenticação já existente
2. Evitar problemas de compatibilidade entre Chrome e ChromeDriver
3. Interagir com páginas que requerem login

### Passos para Uso Correto

1. **Abra o navegador embutido** na aplicação clicando no menu "Navegador"
2. **Navegue até a página que deseja automatizar** e faça login se necessário
3. **Inicie a automação** usando o botão na interface

## Solução de Problemas

### Erro de ChromeDriver

Se encontrar erros relacionados ao ChromeDriver:

1. Defina a variável de ambiente `CHROME_DRIVER_PATH` apontando para o executável do ChromeDriver:
   - Windows: `set CHROME_DRIVER_PATH=C:\caminho\para\chromedriver.exe`
   - Linux/Mac: `export CHROME_DRIVER_PATH=/caminho/para/chromedriver`

2. Baixe o ChromeDriver manualmente da página oficial:
   - Acesse: https://chromedriver.chromium.org/downloads
   - Escolha a versão compatível com seu Chrome (verifique em chrome://version/)

### Timeout ao Aguardar Elementos

Se encontrar erros de timeout:

1. Verifique se está autenticado na página antes de iniciar a automação
2. Confirme que os seletores CSS estão corretos para a página específica
3. Aumente os timeouts no arquivo `mpm_autoia_interface_embedded.py` se necessário

## Seletores CSS Padrão

Os seletores padrão são configurados para o Moodle, mas podem ser personalizados:

- Pergunta: `.qtext`
- Opções: `input[type='radio']`
- Botão Próxima: `input[value='Próxima página']`

## Contato e Suporte

Se encontrar problemas persistentes, entre em contato com a equipe de suporte do MPM-autoIA.
