-- Script SQL para configurar o banco de dados Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Criar a tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    data_pagamento DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios(ativo);
CREATE INDEX IF NOT EXISTS idx_usuarios_data_pagamento ON usuarios(data_pagamento);

-- 3. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Criar trigger para atualizar updated_at
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Criar função para inserir usuário automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, email, nome, ativo, data_pagamento)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
        false, -- Por padrão, usuário inativo até ativação manual
        CURRENT_DATE -- Data de pagamento inicial (hoje)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Criar trigger para inserir usuário automaticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Configurar Row Level Security (RLS)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 8. Remover políticas existentes (para evitar conflitos)
DROP POLICY IF EXISTS "Usuários podem ver seus próprios dados" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios dados" ON usuarios;
DROP POLICY IF EXISTS "Administradores podem gerenciar usuários" ON usuarios;

-- 9. Criar políticas de segurança simplificadas
-- Política simples para usuários verem e editarem apenas seus próprios dados
CREATE POLICY "usuarios_policy" ON usuarios
    FOR ALL USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 10. Inserir usuário de teste (opcional - remover em produção)
-- NOTA: Este insert foi removido pois violava a constraint de foreign key
-- Para criar usuários de teste, use o sistema de autenticação do Supabase
-- que criará automaticamente o registro na tabela usuarios via trigger

-- 11. Criar view para estatísticas de usuários (opcional)
CREATE OR REPLACE VIEW usuarios_stats AS
SELECT 
    COUNT(*) as total_usuarios,
    COUNT(*) FILTER (WHERE ativo = true) as usuarios_ativos,
    COUNT(*) FILTER (WHERE ativo = false) as usuarios_inativos,
    COUNT(*) FILTER (WHERE data_pagamento + INTERVAL '30 days' < CURRENT_DATE) as assinaturas_vencidas,
    COUNT(*) FILTER (WHERE data_pagamento + INTERVAL '30 days' BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as vencendo_em_7_dias
FROM usuarios;

-- 11. Comentários nas tabelas e colunas
COMMENT ON TABLE usuarios IS 'Tabela de usuários do sistema MPM AutoIA';
COMMENT ON COLUMN usuarios.id IS 'ID do usuário (referência para auth.users)';
COMMENT ON COLUMN usuarios.email IS 'Email do usuário';
COMMENT ON COLUMN usuarios.nome IS 'Nome completo do usuário';
COMMENT ON COLUMN usuarios.ativo IS 'Status de ativação do usuário';
COMMENT ON COLUMN usuarios.data_pagamento IS 'Data do último pagamento (assinatura válida por 30 dias)';
COMMENT ON COLUMN usuarios.created_at IS 'Data de criação do registro';
COMMENT ON COLUMN usuarios.updated_at IS 'Data da última atualização';

-- Fim do script
-- IMPORTANTE: Gerenciamento de Campos Críticos
-- Os campos 'ativo' e 'data_pagamento' devem ser gerenciados apenas por:
-- 1. Administradores através do painel do Supabase
-- 2. Funções serverless/edge functions com privilégios de service_role
-- 3. Scripts de backend com chaves de administrador

-- Lembre-se de:
-- 1. Configurar as variáveis de ambiente no Supabase
-- 2. Ativar a autenticação por email/senha
-- 3. Configurar as políticas de RLS conforme necessário
-- 4. Remover o usuário de teste em produção
-- 5. Para alterar campos críticos, use o painel admin do Supabase ou APIs com service_role