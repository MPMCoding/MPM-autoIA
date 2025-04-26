# Implementação de Navegador Embutido com Iframe

## Problema Identificado

Após múltiplas tentativas de implementar o navegador embutido usando a tag `<webview>` do Electron, continuamos enfrentando problemas com a exibição do conteúdo. O navegador não carregava corretamente e mostrava apenas a mensagem de fallback.

## Nova Abordagem

Implementei uma solução alternativa usando `<iframe>` em vez de `<webview>`. Esta abordagem tem várias vantagens:

1. **Compatibilidade Universal**: Iframes são suportados em praticamente todos os ambientes, incluindo Electron e navegadores web.
2. **Simplicidade**: Não depende de APIs específicas do Electron que podem variar entre versões.
3. **Independência de Erros**: Funciona mesmo quando há outros erros na aplicação (como o erro do SQLite).

## Implementação

### 1. Substituição do Webview por Iframe

```html
<!-- Abordagem alternativa usando iframe em vez de webview -->
<div class="browser-container" style="width:100%; height:500px; border:1px solid #ccc; overflow:hidden;">
  <iframe #browserFrame [src]="safeUrl" style="width:100%; height:100%; border:none;"></iframe>
</div>
```

### 2. Sanitização de URLs para Segurança

```typescript
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

// No componente
safeUrl: SafeResourceUrl;

constructor(
  private electronService: ElectronService,
  private sanitizer: DomSanitizer
) {
  // ...
  this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
}
```

### 3. Gerenciamento de Histórico de Navegação

```typescript
browserHistory: string[] = [];
currentHistoryIndex: number = -1;

// Atualiza o histórico apenas se for uma nova URL
if (this.browserHistory[this.currentHistoryIndex] !== this.url) {
  // Remove entradas futuras se estamos navegando a partir de um ponto no histórico
  this.browserHistory = this.browserHistory.slice(0, this.currentHistoryIndex + 1);
  this.browserHistory.push(this.url);
  this.currentHistoryIndex = this.browserHistory.length - 1;
}
```

### 4. Manipulação de Eventos de Carregamento

```typescript
// Adiciona evento de carregamento ao iframe
const iframe = this.browserFrameRef.nativeElement;
iframe.onload = () => {
  console.log('Iframe carregado:', this.url);
  this.isLoading = false;
  
  // Atualiza o histórico...
  this.updateNavigationState();
};

iframe.onerror = (error: any) => {
  console.error('Erro ao carregar iframe:', error);
  this.isLoading = false;
};
```

## Vantagens da Nova Solução

1. **Robustez**: Funciona independentemente de problemas com módulos nativos como o SQLite.
2. **Facilidade de Manutenção**: Usa tecnologias web padrão em vez de APIs específicas do Electron.
3. **Melhor Compatibilidade**: Funciona tanto no Electron quanto em navegadores web.
4. **Depuração Simplificada**: Comportamento mais previsível e fácil de depurar.

## Como Testar

1. Execute a aplicação com `npm run electron-start`
2. O navegador embutido deve carregar o Google automaticamente
3. Teste a navegação usando a barra de endereços e os botões de navegação
4. Verifique se os botões de controle da automação funcionam corretamente

## Limitações

1. Algumas restrições de segurança podem impedir o carregamento de certos sites em iframes (política de X-Frame-Options).
2. A automação Python precisará ser adaptada para trabalhar com o conteúdo do iframe em vez do webview.
3. Não é possível acessar diretamente o DOM do conteúdo do iframe de domínios diferentes devido à política de mesma origem.

## Próximos Passos

1. Testar a solução em diferentes ambientes
2. Adaptar o script de automação para trabalhar com o iframe
3. Implementar tratamento para sites que não permitem ser carregados em iframes
