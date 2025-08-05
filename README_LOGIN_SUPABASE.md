# Sistema de Login com Supabase - MPM AutoIA

## Visão Geral

Este sistema implementa um robusto sistema de autenticação usando Supabase com validações de usuário ativo e controle de assinatura mensal.

## Funcionalidades Implementadas

### ✅ Autenticação
- Login seguro com Supabase
- Validação de email e senha
- Sessão persistente com localStorage
- Logout automático em caso de problemas

### ✅ Controle de Usuário
- Verificação de usuário ativo/inativo
- Controle de assinatura mensal
- Avisos de vencimento próximo (7 dias)
- Bloqueio automático após vencimento

### ✅ Interface de Usuário
- Componente de informações do usuário
- Indicadores visuais de status da assinatura
- Barra de progresso para dias restantes
- Avisos e notificações contextuais

### ✅ Segurança
- Guards de rota para proteção
- Row Level Security (RLS) no Supabase
- Validação de sessão em tempo real

## Configuração do Supabase

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova conta ou faça login
3. Clique em "New Project"
4. Escolha sua organização
5. Preencha os dados do projeto:
   - **Name**: MPM AutoIA
   - **Database Password**: (escolha uma senha forte)
   - **Region**: escolha a região mais próxima
6. Clique em "Create new project"

### 2. Configurar o Banco de Dados

1. No painel do Supabase, vá para **SQL Editor**
2. Copie e cole o conteúdo do arquivo `supabase_setup.sql`
3. Execute o script clicando em "Run"
4. Verifique se todas as tabelas foram criadas em **Table Editor**

### 3. Configurar Autenticação

1. Vá para **Authentication** > **Settings**
2. Em **Site URL**, adicione: `http://localhost:4200` (para desenvolvimento)
3. Em **Auth Providers**, certifique-se que **Email** está habilitado
4. Configure as seguintes opções:
   - **Enable email confirmations**: Desabilitado (para desenvolvimento)
   - **Enable phone confirmations**: Desabilitado
   - **Enable email change confirmations**: Habilitado

### 4. Obter Credenciais

1. Vá para **Settings** > **API**
2. Copie as seguintes informações:
   - **Project URL** (algo como: `https://xxxxx.supabase.co`)
   - **anon public** key (chave pública anônima)

## Configuração da Aplicação

### 1. Instalar Dependências

As dependências já foram instaladas automaticamente:
```bash
npm install @supabase/supabase-js
```

### 2. Configurar Credenciais

Ao fazer o primeiro login na aplicação:

1. A tela de configuração do Supabase aparecerá automaticamente
2. Insira a **URL do Supabase** (Project URL)
3. Insira a **Chave Anônima** (anon public key)
4. Clique em "Salvar Configuração"

As credenciais serão salvas no localStorage e reutilizadas automaticamente.

### 3. Criar Usuários de Teste

#### Opção 1: Via SQL (Recomendado para desenvolvimento)

```sql
-- Inserir usuário ativo com assinatura válida
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'admin@mpmautoia.com',
    crypt('123456', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
);

-- O trigger criará automaticamente o registro na tabela usuarios
-- Depois, ative o usuário:
UPDATE usuarios 
SET ativo = true, data_pagamento = CURRENT_DATE 
WHERE email = 'admin@mpmautoia.com';
```

#### Opção 2: Via Interface do Supabase

1. Vá para **Authentication** > **Users**
2. Clique em "Add user"
3. Preencha email e senha
4. Após criar, vá para **Table Editor** > **usuarios**
5. Edite o registro para:
   - `ativo`: true
   - `data_pagamento`: data atual
   - `nome`: nome do usuário

## Estrutura do Sistema

### Serviços

#### AuthService (`src/app/services/auth.service.ts`)
- Gerencia autenticação com Supabase
- Valida status do usuário e assinatura
- Controla sessões e logout

#### AuthGuard (`src/app/guards/auth.guard.ts`)
- Protege rotas que requerem autenticação
- Verifica status da assinatura
- Redireciona para login se necessário

### Componentes

#### LoginComponent
- Interface de login
- Configuração do Supabase
- Validações e mensagens de erro

#### UserInfoComponent
- Exibe informações do usuário logado
- Status da assinatura
- Avisos de vencimento
- Botão de logout

## Fluxo de Autenticação

1. **Acesso à aplicação**: Usuário é redirecionado para `/login`
2. **Configuração**: Se necessário, configura credenciais do Supabase
3. **Login**: Insere email e senha
4. **Validação**: Sistema verifica:
   - Credenciais válidas
   - Usuário ativo
   - Assinatura não vencida
5. **Acesso**: Se tudo OK, redireciona para dashboard
6. **Proteção**: Guards verificam a cada navegação

## Validações de Assinatura

### Status da Assinatura
- **Ativa**: Mais de 7 dias restantes
- **Próxima do vencimento**: 7 dias ou menos
- **Vencida**: Data de vencimento ultrapassada

### Comportamentos
- **> 7 dias**: Acesso normal
- **≤ 7 dias**: Aviso de vencimento próximo
- **≤ 0 dias**: Bloqueio total e logout forçado

## Gerenciamento de Usuários

### Ativar/Desativar Usuário
```sql
-- Ativar usuário
UPDATE usuarios SET ativo = true WHERE email = 'usuario@email.com';

-- Desativar usuário
UPDATE usuarios SET ativo = false WHERE email = 'usuario@email.com';
```

### Renovar Assinatura
```sql
-- Renovar por 30 dias a partir de hoje
UPDATE usuarios 
SET data_pagamento = CURRENT_DATE 
WHERE email = 'usuario@email.com';

-- Renovar por 30 dias a partir do vencimento atual
UPDATE usuarios 
SET data_pagamento = GREATEST(data_pagamento + INTERVAL '30 days', CURRENT_DATE)
WHERE email = 'usuario@email.com';
```

### Consultar Estatísticas
```sql
-- Ver estatísticas gerais
SELECT * FROM usuarios_stats;

-- Usuários próximos do vencimento
SELECT nome, email, data_pagamento, 
       (data_pagamento + INTERVAL '30 days') as vencimento,
       (data_pagamento + INTERVAL '30 days' - CURRENT_DATE) as dias_restantes
FROM usuarios 
WHERE ativo = true 
  AND (data_pagamento + INTERVAL '30 days') BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY data_pagamento;
```

## Troubleshooting

### Problemas Comuns

#### "Erro na autenticação"
- Verifique se as credenciais do Supabase estão corretas
- Confirme se o projeto está ativo no Supabase
- Verifique se a autenticação por email está habilitada

#### "Usuário não encontrado"
- Verifique se o usuário existe na tabela `usuarios`
- Confirme se o trigger `on_auth_user_created` está funcionando
- Execute manualmente o INSERT na tabela `usuarios`

#### "Assinatura expirada" (mas deveria estar válida)
- Verifique a data em `data_pagamento`
- Confirme se o cálculo de 30 dias está correto
- Verifique o fuso horário do servidor

#### Configuração não salva
- Limpe o localStorage: `localStorage.clear()`
- Verifique se o navegador permite localStorage
- Tente em modo incógnito

### Logs e Debug

Para debug, abra o console do navegador (F12) e verifique:
- Erros de autenticação
- Problemas de conexão com Supabase
- Validações de data

### Reset Completo

Para resetar completamente:

1. Limpar localStorage:
```javascript
localStorage.clear();
```

2. Recriar tabelas no Supabase:
```sql
DROP TABLE IF EXISTS usuarios CASCADE;
-- Execute novamente o script supabase_setup.sql
```

## Segurança

### Boas Práticas Implementadas
- Row Level Security (RLS) habilitado
- Políticas de acesso restritivas
- Validação de sessão em tempo real
- Logout automático em caso de problemas
- Não exposição de dados sensíveis no frontend

### Recomendações para Produção
- Use HTTPS sempre
- Configure domínios permitidos no Supabase
- Implemente rate limiting
- Configure backup automático do banco
- Monitore logs de acesso
- Use senhas fortes para usuários

## Próximos Passos

### Funcionalidades Futuras
- [ ] Recuperação de senha
- [ ] Cadastro de novos usuários
- [ ] Perfil do usuário editável
- [ ] Histórico de pagamentos
- [ ] Notificações por email
- [ ] Dashboard administrativo
- [ ] Relatórios de uso

### Melhorias Técnicas
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Cache de dados do usuário
- [ ] Offline support
- [ ] PWA features

---

**Desenvolvido para MPM AutoIA**  
*Sistema de automação educacional com controle de acesso robusto*