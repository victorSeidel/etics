import { pdfQueue } from '../services/queueService.js';
import { processPdf } from '../services/ocrService.js';

console.log('[Worker] Iniciando OCR Worker...');

pdfQueue.process(async (job) =>
{
    console.log(`[Worker] Processando job ${job.id}`);

    try 
    {
        const result = await processPdf(job);
        return result;
    } 
    catch (error) 
    {
        console.error(`[Worker] Erro ao processar job ${job.id}:`, error);
        throw error;
    }
});

console.log('[Worker] OCR Worker pronto para processar jobs');

process.on('SIGTERM', async () => 
{
    console.log('[Worker] Recebido sinal de encerramento');
    await pdfQueue.close();
    process.exit(0);
});
