-- Adicionar colunas de arquivado e favorito na tabela de processos
ALTER TABLE processes 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Tabela de tags
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) DEFAULT '#000000',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de relacionamento entre processos e tags
CREATE TABLE IF NOT EXISTS process_tags (
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (process_id, tag_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_processes_is_archived ON processes(is_archived);
CREATE INDEX IF NOT EXISTS idx_processes_is_favorite ON processes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
