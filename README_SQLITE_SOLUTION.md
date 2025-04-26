# Solução para o Problema do SQLite com electron-rebuild

## Problema Identificado

O projeto estava enfrentando um erro com o módulo better-sqlite3 devido a uma incompatibilidade de versões do Node.js:

```
Error: The module '\\?\C:\Projetos\MpAutoIA\MPM-autoIA\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 115. This version of Node.js requires
NODE_MODULE_VERSION 116.
```

Este erro ocorre porque o módulo better-sqlite3 foi compilado para uma versão específica do Node.js, mas o Electron usa uma versão diferente.

## Solução Implementada

A solução foi implementar o electron-rebuild, que recompila automaticamente os módulos nativos para a versão correta do Node.js usada pelo Electron:

1. Adicionamos electron-rebuild como dependência de desenvolvimento:
```json
"electron-rebuild": "^3.2.13"
```

2. Adicionamos scripts no package.json para facilitar a reconstrução:
```json
"postinstall": "electron-rebuild",
"rebuild": "electron-rebuild"
```

## Como Usar

Após clonar o repositório, execute os seguintes comandos:

1. Instale as dependências normalmente:
```
npm install
```

2. O script postinstall executará automaticamente o electron-rebuild. Se precisar reconstruir manualmente, use:
```
npm run rebuild
```

## Benefícios

- Resolve o erro do SQLite automaticamente durante a instalação
- Não é necessário modificar o código da aplicação
- Funciona em diferentes ambientes de desenvolvimento
- Mantém a compatibilidade com versões futuras do Electron

## Observações

- O electron-rebuild pode levar alguns minutos para ser concluído, dependendo do hardware
- É necessário ter as ferramentas de compilação adequadas instaladas no sistema (como Visual Studio Build Tools no Windows)
- Esta solução é recomendada pela documentação oficial do Electron para lidar com módulos nativos
