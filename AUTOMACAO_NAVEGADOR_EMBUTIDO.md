# Documentação da Automação no Navegador Embutido

## Visão Geral

Esta documentação descreve a solução implementada para permitir a automação de interações web diretamente no navegador embutido do Electron, sem a necessidade de abrir janelas externas do Chrome.

## Problema Resolvido

O problema original era que a automação web estava tentando abrir uma nova janela do Chrome em vez de usar o navegador embutido que já estava sendo exibido e possivelmente autenticado. Isso causava falhas em páginas que requerem autenticação.

## Solução Implementada

Foi desenvolvida uma solução robusta (`robust_embedded_automation.py`) que utiliza comunicação via JavaScript para interagir diretamente com o navegador embutido do Electron. Esta abordagem evita a necessidade de conectar via debuggerAddress e não abre novas janelas.

### Principais Características

1. **Comunicação via JavaScript**: Utiliza arquivos de comando e resultado para comunicação entre Python e Electron
2. **Múltiplas Tentativas**: Implementa sistema de retry para garantir a execução dos comandos
3. **Seletores Alternativos**: Tenta múltiplos seletores CSS para encontrar elementos na página
4. **Tratamento Robusto de Erros**: Logging detalhado e tratamento de exceções
5. **Verificação da URL**: Verifica a URL atual antes de navegar
6. **Limpeza de Arquivos**: Remove arquivos temporários após a execução

## Como Funciona

1. O script Python cria um arquivo com código JavaScript a ser executado
2. O Electron monitora este arquivo e executa o código no navegador embutido
3. O resultado é salvo em outro arquivo que o Python lê
4. Este ciclo se repete para cada ação necessária (navegar, clicar, etc.)

## Requisitos

- Python 3.6 ou superior
- Selenium (`pip install selenium`)
- webdriver-manager (`pip install webdriver-manager`)

## Uso

A automação é iniciada através da interface do aplicativo, clicando no botão de automação. O script usa a URL atual do navegador embutido.

### Parâmetros Opcionais

Se necessário, você pode personalizar os seletores CSS usados para encontrar elementos na página:

```
python robust_embedded_automation.py --url "https://exemplo.com" --question-selector ".minha-classe-pergunta" --options-selector ".minha-classe-opcoes" --next-button-selector ".meu-botao-proximo"
```

## Solução de Problemas

Se a automação não funcionar corretamente:

1. Verifique se o navegador embutido está funcionando e exibindo a página correta
2. Certifique-se de que você já está autenticado na página que deseja automatizar
3. Verifique os logs para mensagens de erro detalhadas
4. Tente reiniciar a aplicação para garantir que as configurações sejam aplicadas corretamente

## Arquivos Principais

- `robust_embedded_automation.py`: Script principal de automação
- `main.js`: Arquivo do Electron que gerencia o navegador embutido e a comunicação com o script Python

## Limitações

- A automação depende da estrutura HTML da página, que pode mudar
- Algumas páginas com JavaScript complexo podem não funcionar corretamente
- A automação é mais lenta que a abordagem tradicional do Selenium devido à comunicação indireta
