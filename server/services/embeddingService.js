import OpenAI from 'openai';
import { pool } from '../db.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_SIZE = 1000; // Tokens aproximados (aprox 4000 caracteres)
const CHUNK_OVERLAP = 200; // Tokens de sobreposição

export async function generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
        throw new Error('Texto vazio não pode gerar embedding');
    }

    try {
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text,
            encoding_format: 'float'
        });

        const embedding = response.data[0].embedding;

        if (embedding.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(`Embedding com dimensões incorretas: ${embedding.length} (esperado: ${EMBEDDING_DIMENSIONS})`);
        }

        return embedding;

    } catch (error) {
        console.error('[EMBEDDING] Erro ao gerar embedding:', error);
        throw new Error(`Falha ao gerar embedding: ${error.message}`);
    }
}

function splitTextIntoChunks(text) {
    // Estimativa simples: 1 token ~= 4 caracteres
    const charLimit = CHUNK_SIZE * 4;
    const overlapChars = CHUNK_OVERLAP * 4;

    const chunks = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        let endIndex = startIndex + charLimit;

        if (endIndex < text.length) {
            // Tenta cortar no último ponto ou quebra de linha para não cortar frases no meio
            const lastPeriod = text.lastIndexOf('.', endIndex);
            const lastNewline = text.lastIndexOf('\n', endIndex);

            const cutIndex = Math.max(lastPeriod, lastNewline);

            if (cutIndex > startIndex + (charLimit * 0.5)) { // Se encontrou um ponto razoável
                endIndex = cutIndex + 1;
            }
        }

        const chunk = text.substring(startIndex, endIndex).trim();

        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        startIndex = endIndex - overlapChars;

        // Evita loop infinito se o overlap for maior que o avanço
        if (startIndex >= endIndex) {
            startIndex = endIndex;
        }
    }

    return chunks;
}

export async function generateEmbeddingForPdf(pdfId) {
    const client = await pool.connect();

    try {
        // Busca o PDF
        const pdfResult = await client.query(
            'SELECT id, original_filename, extracted_text FROM process_pdfs WHERE id = $1',
            [pdfId]
        );

        if (pdfResult.rows.length === 0) {
            throw new Error('PDF não encontrado');
        }

        const pdf = pdfResult.rows[0];

        if (!pdf.extracted_text || pdf.extracted_text.trim().length === 0) {
            throw new Error('PDF não possui texto extraído');
        }

        console.log(`[EMBEDDING] Gerando embeddings para PDF: ${pdf.original_filename}`);

        // Remove chunks antigos deste PDF
        await client.query('DELETE FROM process_pdf_chunks WHERE pdf_id = $1', [pdfId]);

        // Divide o texto em chunks
        const chunks = splitTextIntoChunks(pdf.extracted_text);
        console.log(`[EMBEDDING] Texto dividido em ${chunks.length} chunks`);

        let generatedCount = 0;

        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];

            try {
                const embedding = await generateEmbedding(chunkText);
                const embeddingArray = '[' + embedding.join(',') + ']';

                await client.query(
                    `INSERT INTO process_pdf_chunks (pdf_id, chunk_index, content, embedding)
                     VALUES ($1, $2, $3, $4::vector)`,
                    [pdfId, i, chunkText, embeddingArray]
                );

                generatedCount++;

                // Pequeno delay para evitar rate limit em documentos grandes
                if (i % 10 === 0 && i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

            } catch (error) {
                console.error(`[EMBEDDING] Erro ao gerar embedding para chunk ${i} do PDF ${pdf.original_filename}:`, error);
                // Continua para o próximo chunk
            }
        }

        // Atualiza status no PDF
        await client.query(
            `UPDATE process_pdfs 
             SET embedding_generated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [pdfId]
        );

        console.log(`[EMBEDDING] Processamento concluído para PDF: ${pdf.original_filename}. ${generatedCount}/${chunks.length} chunks gerados.`);

        return {
            pdfId: pdf.id,
            filename: pdf.original_filename,
            totalChunks: chunks.length,
            generatedChunks: generatedCount,
            textLength: pdf.extracted_text.length
        };

    } finally {
        client.release();
    }
}

export async function generateEmbeddingsForProcess(processId) {
    const client = await pool.connect();

    try {
        // Busca PDFs que precisam de embedding (agora verifica embedding_generated_at)
        const pdfsResult = await client.query(
            `SELECT id, original_filename 
             FROM process_pdfs 
             WHERE process_id = $1 
             AND status = 'concluido' 
             AND extracted_text IS NOT NULL 
             AND embedding_generated_at IS NULL
             ORDER BY processing_order`,
            [processId]
        );

        const pdfs = pdfsResult.rows;

        if (pdfs.length === 0) {
            return {
                processId,
                totalPdfs: 0,
                generated: 0,
                skipped: 0,
                message: 'Nenhum PDF precisa de embedding'
            };
        }

        console.log(`[EMBEDDING] Gerando embeddings para ${pdfs.length} PDFs do processo ${processId}`);

        let generated = 0;
        let failed = 0;
        const errors = [];

        for (const pdf of pdfs) {
            try {
                await generateEmbeddingForPdf(pdf.id);
                generated++;
            } catch (error) {
                console.error(`[EMBEDDING] Erro ao gerar embedding para PDF ${pdf.original_filename}:`, error);
                failed++;
                errors.push({
                    filename: pdf.original_filename,
                    error: error.message
                });
            }
        }

        return {
            processId,
            totalPdfs: pdfs.length,
            generated,
            failed,
            errors: errors.length > 0 ? errors : undefined
        };

    } finally {
        client.release();
    }
}

export async function searchSimilarChunks(query, processId, limit = 5, minSimilarity = 0.3) {
    const client = await pool.connect();

    try {
        // Gera embedding da query
        console.log(`[EMBEDDING] Gerando embedding para query: "${query.substring(0, 50)}..."`);
        const queryEmbedding = await generateEmbedding(query);
        const queryEmbeddingArray = '[' + queryEmbedding.join(',') + ']';

        console.log(`[EMBEDDING] Buscando chunks com threshold mínimo: ${minSimilarity}`);

        // Busca vetorial usando função customizada cosine_similarity
        const result = await client.query(
            `SELECT 
                c.id,
                p.original_filename,
                c.content as extracted_text,
                cosine_similarity(c.embedding, $1::vector) as similarity
             FROM process_pdf_chunks c
             JOIN process_pdfs p ON c.pdf_id = p.id
             WHERE p.process_id = $2
             AND cosine_similarity(c.embedding, $1::vector) >= $3
             ORDER BY cosine_similarity(c.embedding, $1::vector) DESC
             LIMIT $4`,
            [queryEmbeddingArray, processId, minSimilarity, limit]
        );

        const chunks = result.rows.map(row => ({
            chunkId: row.id,
            filename: row.original_filename,
            text: row.extracted_text,
            similarity: parseFloat(row.similarity.toFixed(4))
        }));

        // Log com estatísticas detalhadas
        if (chunks.length > 0) {
            const similarities = chunks.map(c => c.similarity);
            const maxSim = Math.max(...similarities);
            const minSim = Math.min(...similarities);
            const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;

            console.log(`[EMBEDDING] ✓ Encontrados ${chunks.length} chunks similares`);
            console.log(`[EMBEDDING]   Similaridade: max=${(maxSim * 100).toFixed(1)}%, min=${(minSim * 100).toFixed(1)}%, média=${(avgSim * 100).toFixed(1)}%`);
        } else {
            console.log(`[EMBEDDING] ✗ Nenhum chunk encontrado acima do threshold de ${(minSimilarity * 100).toFixed(0)}%`);
        }

        return chunks;

    } finally {
        client.release();
    }
}

export async function hasEmbedding(pdfId) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            'SELECT embedding_generated_at IS NOT NULL as has_embedding FROM process_pdfs WHERE id = $1',
            [pdfId]
        );

        return result.rows.length > 0 && result.rows[0].has_embedding;

    } finally {
        client.release();
    }
}

export async function getEmbeddingStats(processId) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT
                COUNT(*) as total_pdfs,
                COUNT(embedding_generated_at) as pdfs_with_embedding,
                COUNT(*) - COUNT(embedding_generated_at) as pdfs_without_embedding
             FROM process_pdfs
             WHERE process_id = $1 AND status = 'concluido' AND extracted_text IS NOT NULL`,
            [processId]
        );

        const stats = result.rows[0];

        // Conta total de chunks
        const chunksResult = await client.query(
            `SELECT COUNT(*) as total_chunks
             FROM process_pdf_chunks c
             JOIN process_pdfs p ON c.pdf_id = p.id
             WHERE p.process_id = $1`,
            [processId]
        );

        return {
            totalPdfs: parseInt(stats.total_pdfs),
            withEmbedding: parseInt(stats.pdfs_with_embedding),
            withoutEmbedding: parseInt(stats.pdfs_without_embedding),
            totalChunks: parseInt(chunksResult.rows[0].total_chunks),
            coverage: stats.total_pdfs > 0
                ? ((stats.pdfs_with_embedding / stats.total_pdfs) * 100).toFixed(2) + '%'
                : '0%'
        };

    } finally {
        client.release();
    }
}
