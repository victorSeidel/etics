import { pool } from '../db.js';
import { generateEmbeddingForPdf, generateEmbeddingsForProcess, getEmbeddingStats } from '../services/embeddingService.js';

/**
 * Script para gerar embeddings para PDFs existentes no banco de dados
 * Uso:
 *   node server/scripts/generateEmbeddings.js [--process-id=UUID] [--force] [--test]
 */

const args = process.argv.slice(2);
const processIdArg = args.find(arg => arg.startsWith('--process-id='));
const forceRegenerate = args.includes('--force');
const testMode = args.includes('--test');

async function generateAllEmbeddings() {
    const client = await pool.connect();

    try {
        console.log('='.repeat(60));
        console.log('GERAÇÃO DE EMBEDDINGS PARA PDFS');
        console.log('='.repeat(60));

        // Se foi especificado um processo específico
        if (processIdArg) {
            const processId = processIdArg.split('=')[1];
            console.log(`\nProcessando apenas o processo: ${processId}\n`);

            const result = await generateEmbeddingsForProcess(processId);

            console.log('\n' + '='.repeat(60));
            console.log('RESULTADO:');
            console.log(`- Total de PDFs: ${result.totalPdfs}`);
            console.log(`- Embeddings gerados: ${result.generated}`);
            console.log(`- Falhas: ${result.failed}`);

            if (result.errors && result.errors.length > 0) {
                console.log('\nErros:');
                result.errors.forEach(err => {
                    console.log(`  - ${err.filename}: ${err.error}`);
                });
            }

            console.log('='.repeat(60));
            return;
        }

        // Busca todos os processos concluídos
        const processesResult = await client.query(
            `SELECT DISTINCT p.id, p.name, COUNT(pdf.id) as pdf_count
             FROM processes p
             JOIN process_pdfs pdf ON p.id = pdf.process_id
             WHERE p.status = 'concluido' 
             AND pdf.status = 'concluido' 
             AND pdf.extracted_text IS NOT NULL
             ${forceRegenerate ? '' : 'AND pdf.embedding IS NULL'}
             GROUP BY p.id, p.name
             ORDER BY p.created_at DESC`
        );

        const processes = processesResult.rows;

        if (processes.length === 0) {
            console.log('\n✓ Nenhum processo precisa de embeddings!\n');
            return;
        }

        console.log(`\nEncontrados ${processes.length} processos que precisam de embeddings:\n`);

        let totalGenerated = 0;
        let totalFailed = 0;
        let processedCount = 0;

        for (const process of processes) {
            processedCount++;
            console.log(`\n[${processedCount}/${processes.length}] Processo: ${process.name} (${process.pdf_count} PDFs)`);

            if (testMode && processedCount > 1) {
                console.log('  [MODO TESTE] Pulando demais processos...');
                break;
            }

            try {
                const result = await generateEmbeddingsForProcess(process.id);

                totalGenerated += result.generated;
                totalFailed += result.failed;

                console.log(`  ✓ Gerados: ${result.generated}, Falhas: ${result.failed}`);

                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(err => {
                        console.log(`    ✗ ${err.filename}: ${err.error}`);
                    });
                }

                // Pequeno delay para evitar rate limiting da OpenAI
                if (processedCount < processes.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (error) {
                console.error(`  ✗ Erro ao processar processo: ${error.message}`);
                totalFailed++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('RESUMO FINAL:');
        console.log(`- Processos processados: ${processedCount}`);
        console.log(`- Total de embeddings gerados: ${totalGenerated}`);
        console.log(`- Total de falhas: ${totalFailed}`);
        console.log('='.repeat(60));

        if (testMode) {
            console.log('\n[MODO TESTE] Processamento limitado concluído.');
        }

    } catch (error) {
        console.error('\n✗ Erro fatal:', error);
        throw error;
    } finally {
        client.release();
    }
}

async function showStats() {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT 
                COUNT(DISTINCT process_id) as total_processes,
                COUNT(*) as total_pdfs,
                COUNT(embedding) as pdfs_with_embedding,
                COUNT(*) - COUNT(embedding) as pdfs_without_embedding
             FROM process_pdfs
             WHERE status = 'concluido' AND extracted_text IS NOT NULL`
        );

        const stats = result.rows[0];

        console.log('\n' + '='.repeat(60));
        console.log('ESTATÍSTICAS DE EMBEDDINGS');
        console.log('='.repeat(60));
        console.log(`Processos: ${stats.total_processes}`);
        console.log(`Total de PDFs: ${stats.total_pdfs}`);
        console.log(`PDFs com embedding: ${stats.pdfs_with_embedding}`);
        console.log(`PDFs sem embedding: ${stats.pdfs_without_embedding}`);
        console.log(`Total de Chunks: ${stats.totalChunks || 0}`);
        console.log(`Cobertura: ${((stats.pdfs_with_embedding / stats.total_pdfs) * 100).toFixed(2)}%`);
        console.log('='.repeat(60) + '\n');

    } finally {
        client.release();
    }
}

// Executa o script
(async () => {
    try {
        await showStats();
        await generateAllEmbeddings();
        await showStats();

        console.log('\n✓ Script concluído com sucesso!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n✗ Erro ao executar script:', error);
        process.exit(1);
    }
})();
