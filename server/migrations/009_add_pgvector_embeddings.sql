-- Habilita a extensão pgvector para suporte a vetores
CREATE EXTENSION IF NOT EXISTS vector;

-- Adiciona coluna de embedding na tabela process_pdfs
ALTER TABLE process_pdfs 
ADD COLUMN IF NOT EXISTS embedding vector(1536),
ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMP;

-- Cria índice HNSW para busca eficiente de vetores
-- m=16: número de conexões bidirecionais por camada (padrão, bom balanceamento)
-- ef_construction=64: tamanho da lista dinâmica durante construção (padrão)
CREATE INDEX IF NOT EXISTS idx_process_pdfs_embedding 
ON process_pdfs 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Adiciona índice composto para buscar embeddings por processo
CREATE INDEX IF NOT EXISTS idx_process_pdfs_process_embedding 
ON process_pdfs(process_id) 
WHERE embedding IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN process_pdfs.embedding IS 'Vetor de embedding de 1536 dimensões gerado pela OpenAI (text-embedding-3-small)';
COMMENT ON COLUMN process_pdfs.embedding_generated_at IS 'Timestamp de quando o embedding foi gerado';
COMMENT ON INDEX idx_process_pdfs_embedding IS 'Índice HNSW para busca rápida de similaridade de vetores usando distância de cosseno';
