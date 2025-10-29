-- Tabela principal de processos
CREATE TABLE IF NOT EXISTS processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    lawyer VARCHAR(255),
    defendants TEXT[],
    status VARCHAR(50) DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'processando', 'concluido', 'erro')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    total_pdfs INTEGER DEFAULT 0,
    processed_pdfs INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de PDFs individuais dentro de cada processo
CREATE TABLE IF NOT EXISTS process_pdfs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    page_count INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'processando', 'concluido', 'erro')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    extracted_text TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_order INTEGER DEFAULT 0
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_processes_user_id ON processes(user_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_created_at ON processes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_process_pdfs_process_id ON process_pdfs(process_id);
CREATE INDEX IF NOT EXISTS idx_process_pdfs_status ON process_pdfs(status);
CREATE INDEX IF NOT EXISTS idx_process_pdfs_order ON process_pdfs(process_id, processing_order);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON processes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_process_pdfs_updated_at BEFORE UPDATE ON process_pdfs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
