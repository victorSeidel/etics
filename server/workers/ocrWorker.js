import { pdfQueue } from '../services/queueService.js';
import { processPdf } from '../services/ocrService.js';

const JOB_TYPE = 'pdf-ocr';
const MAX_WORKERS = parseInt(process.env.OCR_WORKERS, 10) || 8;

console.log('[Worker] Iniciando OCR Worker...');

pdfQueue.process(JOB_TYPE, MAX_WORKERS, async (job) =>
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