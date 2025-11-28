import { pdfQueue } from '../services/queueService.js';

async function cancelAllJobs() 
{
    const jobs = await pdfQueue.getJobs(['waiting', 'active', 'delayed', 'failed', 'paused']);
    for (const job of jobs) 
    {
        try 
        {
            await job.remove();
            console.log(`[JOBS] Job ${job.id} removido`);
        } 
        catch (err) 
        {
            console.error(`[JOBS] Não foi possível remover o job ${job.id}: ${err.message}`);
        }
    }
    console.log('[JOBS] Processamento concluído.');
    process.exit(0);
}

cancelAllJobs();