-- Migration: Criar tabela de chunks com embeddings e função de similaridade
-- Esta migration corrige o problema onde o código tentava usar process_pdf_chunks
-- mas a tabela nunca havia sido criada

-- Habilita a extensão pgvector (caso ainda não esteja habilitada)
CREATE EXTENSION IF NOT EXISTS vector;

-- Remove colunas antigas de embedding da tabela process_pdfs
-- (embeddings agora serão armazenados por chunk, não por PDF completo)
ALTER TABLE process_pdfs 
DROP COLUMN IF EXISTS embedding CASCADE;

-- Mantém a coluna embedding_generated_at para controle
-- (será usada para saber se os chunks já foram gerados)

-- Cria a tabela de chunks com embeddings
CREATE TABLE IF NOT EXISTS process_pdf_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdf_id UUID NOT NULL REFERENCES process_pdfs(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Garante que não haja chunks duplicados
    UNIQUE(pdf_id, chunk_index)
);

-- Cria função para calcular similaridade de cosseno entre vetores
-- Fórmula: similarity = (A · B) / (||A|| * ||B||)
-- Retorna valor entre -1 e 1, onde 1 = vetores idênticos
CREATE OR REPLACE FUNCTION cosine_similarity(vec1 vector, vec2 vector)
RETURNS float8 AS $$
DECLARE
    dot_product float8;
    norm1 float8;
    norm2 float8;
BEGIN
    -- Verifica se os vetores têm a mesma dimensão
    IF array_length(vec1::real[], 1) != array_length(vec2::real[], 1) THEN
        RAISE EXCEPTION 'Vetores devem ter a mesma dimensão';
    END IF;
    
    -- Calcula o produto escalar (dot product) usando operador <#>
    -- O operador <#> retorna o NEGATIVO do produto interno
    dot_product := -(vec1 <#> vec2);
    
    -- Calcula as normas (magnitudes) dos vetores
    -- ||A|| = sqrt(A · A) = sqrt(-(A <#> A))
    norm1 := sqrt(-(vec1 <#> vec1));
    norm2 := sqrt(-(vec2 <#> vec2));
    
    -- Evita divisão por zero
    IF norm1 = 0 OR norm2 = 0 THEN
        RETURN 0;
    END IF;
    
    -- Calcula e retorna a similaridade de cosseno
    RETURN dot_product / (norm1 * norm2);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- Cria índice HNSW otimizado para busca vetorial
-- Usa operador de distância de cosseno (<=>)
-- m=16: número de conexões bidirecionais por camada (padrão)
-- ef_construction=64: tamanho da lista dinâmica durante construção
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_embedding 
ON process_pdf_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para buscar chunks por PDF
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_id 
ON process_pdf_chunks(pdf_id);

-- Índice composto para ordenação por índice dentro de cada PDF
CREATE INDEX IF NOT EXISTS idx_pdf_chunks_pdf_chunk 
ON process_pdf_chunks(pdf_id, chunk_index);

-- Comentários para documentação
COMMENT ON TABLE process_pdf_chunks IS 'Armazena chunks (fragmentos) de texto extraído dos PDFs com seus embeddings vetoriais';
COMMENT ON COLUMN process_pdf_chunks.chunk_index IS 'Índice sequencial do chunk dentro do PDF (0-based)';
COMMENT ON COLUMN process_pdf_chunks.content IS 'Conteúdo de texto do chunk (~4000 caracteres)';
COMMENT ON COLUMN process_pdf_chunks.embedding IS 'Vetor de embedding de 1536 dimensões gerado pela OpenAI (text-embedding-3-small)';
COMMENT ON FUNCTION cosine_similarity IS 'Calcula similaridade de cosseno entre dois vetores, retornando valor entre -1 e 1';
COMMENT ON INDEX idx_pdf_chunks_embedding IS 'Índice HNSW para busca rápida de similaridade vetorial usando distância de cosseno';
