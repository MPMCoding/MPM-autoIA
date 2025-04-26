# Implementação do Navegador Embutido com Automação

Este documento descreve as alterações realizadas para implementar um navegador embutido com Google e botões de controle para a automação Python no projeto MPM-autoIA.

## Alterações Realizadas

### 1. Navegador Embutido com Google

- Modificado o componente `NavegadorComponent` para carregar o Google por padrão
- Adicionado suporte para navegação completa com controles de voltar, avançar e recarregar
- Implementado tratamento adequado de URLs para garantir que sempre comecem com http:// ou https://

### 2. Botões de Controle da Automação

- Adicionados botões para iniciar, pausar/continuar e parar a automação
- Implementada lógica de estado para controlar quando os botões devem estar habilitados/desabilitados
- Adicionado indicador visual do status da automação (em execução, pausada)

### 3. Integração com a Automação Python

- Criado novo script `mpm_autoia_interface_embedded.py` adaptado para funcionar com o navegador embutido
- Implementada comunicação bidirecional entre o Electron e o script Python
- Adicionado suporte para pausar, continuar e parar a automação a partir da interface

### 4. Modificações no Processo Principal do Electron

- Adicionados manipuladores de eventos IPC para controlar o processo de automação Python
- Implementada lógica para iniciar, pausar e parar o processo Python
- Configurada comunicação de logs e erros entre o processo Python e a interface

## Arquivos Modificados

1. `/src/app/components/navegador/navegador.component.ts`
2. `/src/app/components/navegador/navegador.component.html`
3. `/main.js`

## Arquivos Criados

1. `/mpm_autoia_interface_embedded.py` - Versão adaptada do script de automação
2. `/requirements_embedded.txt` - Dependências para o script de automação

## Como Usar

1. Inicie a aplicação com `npm run electron-start`
2. O navegador embutido carregará o Google automaticamente
3. Use os controles de navegação para acessar o site desejado
4. Quando estiver pronto, clique em "Iniciar Automação" para começar a automação
5. Use os botões "Pausar" e "Parar" para controlar a automação em execução

## Requisitos

Para que a automação funcione corretamente, é necessário instalar as dependências Python:

```
pip install -r requirements_embedded.txt
```

## Observações

- A automação funciona em modo headless, ou seja, não abre uma janela separada do navegador
- O script de automação recebe a URL atual do navegador embutido
- É possível pausar e continuar a automação a qualquer momento
- Os logs da automação são exibidos no console do Electron e podem ser integrados à interface no futuro
