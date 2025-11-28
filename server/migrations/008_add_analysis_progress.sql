-- Alterar a tabela process_analyses para suportar progresso e conteúdo nulo

-- 1. Permitir que analysis_content seja nulo (pois começa vazio)
ALTER TABLE process_analyses ALTER COLUMN analysis_content DROP NOT NULL;

-- 2. Adicionar colunas de progresso
ALTER TABLE process_analyses ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE process_analyses ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0;
ALTER TABLE process_analyses ADD COLUMN IF NOT EXISTS status_message TEXT;
