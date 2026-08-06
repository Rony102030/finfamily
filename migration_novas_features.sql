-- ============================================================
-- MIGRAÇÃO: Novas features do FinFamily
-- Empréstimos, Classificação Automática, Transações Pluggy, Notificações
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1. TRANSAÇÕES PLUGGY (transações importadas do banco)
CREATE TABLE IF NOT EXISTS transacoes_pluggy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    pluggy_id TEXT,
    tipo TEXT NOT NULL CHECK (tipo IN ('CREDIT', 'DEBIT')),
    descricao TEXT NOT NULL,
    valor NUMERIC(12,2) NOT NULL,
    data DATE NOT NULL,
    mes TEXT NOT NULL,
    status_pluggy TEXT DEFAULT 'POSTED',
    metodo_pagamento TEXT,
    pagador_nome TEXT,
    recebedor_nome TEXT,
    saldo_apos NUMERIC(12,2),
    classificado BOOLEAN DEFAULT FALSE,
    lancamento_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transacoes_pluggy_user ON transacoes_pluggy(user_id);
CREATE INDEX idx_transacoes_pluggy_mes ON transacoes_pluggy(user_id, mes);
CREATE INDEX idx_transacoes_pluggy_classificado ON transacoes_pluggy(user_id, classificado);
CREATE UNIQUE INDEX idx_transacoes_pluggy_unique ON transacoes_pluggy(user_id, pluggy_id) WHERE pluggy_id IS NOT NULL;

-- 2. REGRAS DE CLASSIFICAÇÃO (regex que aprende)
CREATE TABLE IF NOT EXISTS regras_classificacao (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    padrao TEXT NOT NULL,
    tipo_transacao TEXT NOT NULL CHECK (tipo_transacao IN ('renda', 'despesa', 'emprestimo', 'investimento_negocio', 'devolucao')),
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    subcategoria_id UUID REFERENCES subcategorias(id) ON DELETE SET NULL,
    fonte_renda_id UUID REFERENCES fontes_renda(id) ON DELETE SET NULL,
    carteira_id UUID REFERENCES carteiras(id) ON DELETE SET NULL,
    vezes_usada INTEGER DEFAULT 1,
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_regras_user ON regras_classificacao(user_id, ativo);

-- 3. EMPRÉSTIMOS
CREATE TABLE IF NOT EXISTS emprestimos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    descricao TEXT NOT NULL,
    pessoa TEXT NOT NULL,
    valor_original NUMERIC(12,2) NOT NULL,
    valor_devolvido NUMERIC(12,2) DEFAULT 0,
    data_emprestimo DATE NOT NULL,
    data_quitacao DATE,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'parcial', 'quitado')),
    observacao TEXT,
    transacao_pluggy_id UUID REFERENCES transacoes_pluggy(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emprestimos_user ON emprestimos(user_id);
CREATE INDEX idx_emprestimos_status ON emprestimos(user_id, status);

-- 4. DEVOLUÇÕES DE EMPRÉSTIMO
CREATE TABLE IF NOT EXISTS devolucoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    emprestimo_id UUID REFERENCES emprestimos(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    valor NUMERIC(12,2) NOT NULL,
    data DATE NOT NULL,
    observacao TEXT,
    transacao_pluggy_id UUID REFERENCES transacoes_pluggy(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devolucoes_emprestimo ON devolucoes(emprestimo_id);

-- 5. NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('classificar', 'emprestimo_pendente', 'limite_categoria', 'devolucao_detectada', 'geral')),
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    acao_url TEXT,
    referencia_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_user ON notificacoes(user_id, lida);

-- 6. CONFIGURAÇÃO PLUGGY (credenciais e estado da conexão)
CREATE TABLE IF NOT EXISTS pluggy_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    item_id TEXT,
    connector_id INTEGER DEFAULT 200,
    last_sync TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pendente' CHECK (sync_status IN ('pendente', 'sincronizando', 'ok', 'erro')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE transacoes_pluggy ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_classificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pluggy_config ENABLE ROW LEVEL SECURITY;

-- Policies: cada usuário só vê/edita seus próprios dados
CREATE POLICY "Users see own transacoes_pluggy" ON transacoes_pluggy FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own regras_classificacao" ON regras_classificacao FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own emprestimos" ON emprestimos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own devolucoes" ON devolucoes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own notificacoes" ON notificacoes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users see own pluggy_config" ON pluggy_config FOR ALL USING (auth.uid() = user_id);
