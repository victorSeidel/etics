-- Tabela de configurações (se não existir)
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para armazenar as análises geradas
CREATE TABLE IF NOT EXISTS process_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('geral', 'focada')),
    focus_target VARCHAR(255), -- Nome do advogado ou réu para análise focada
    focus_type VARCHAR(50) CHECK (focus_type IN ('advogado', 'reu')),
    prompt_used TEXT NOT NULL,
    analysis_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'concluida' CHECK (status IN ('gerando', 'concluida', 'erro')),
    error_message TEXT,
    tokens_used INTEGER,
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para registrar o uso de créditos de análise
CREATE TABLE IF NOT EXISTS analysis_credits (
    id SERIAL PRIMARY KEY,
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('geral', 'focada')),
    credits_used INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_process_analyses_process_id ON process_analyses(process_id);
CREATE INDEX IF NOT EXISTS idx_process_analyses_user_id ON process_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_process_analyses_type ON process_analyses(type);
CREATE INDEX IF NOT EXISTS idx_process_analyses_created_at ON process_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_credits_process_id ON analysis_credits(process_id);
CREATE INDEX IF NOT EXISTS idx_analysis_credits_user_id ON analysis_credits(user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_process_analyses_updated_at BEFORE UPDATE ON process_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir configurações de prompts no config se não existirem
INSERT INTO config (name, value) VALUES
('prompt_general_analysis', 'Você é um assistente jurídico especializado. Analise os seguintes documentos jurídicos e forneça uma análise geral e abrangente do processo, incluindo os principais pontos, argumentos, evidências e conclusões relevantes.'),
('prompt_focused_analysis', 'Você é um assistente jurídico especializado. Analise os seguintes documentos jurídicos com foco específico em {FOCUS_TARGET} ({FOCUS_TYPE}). Forneça uma análise detalhada considerando todas as menções, argumentos, evidências e informações relevantes relacionadas a esta parte.')
ON CONFLICT (name) DO NOTHING;
