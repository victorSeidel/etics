import Queue from 'bull';

const JOB_TYPE = 'pdf-ocr';

const redisConfig = 
{
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
};

export const pdfQueue = new Queue('pdf-processing', 
{
    redis: redisConfig,
    defaultJobOptions: 
    {
        attempts: 3,
        backoff: 
        {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
    },
});

pdfQueue.on('active', (job) => { console.log(`[Queue] Job ${job.id} iniciado - PDF: ${job.data.filename}`); });
pdfQueue.on('completed', (job) => { console.log(`[Queue] Job ${job.id} concluído - PDF: ${job.data.filename}`); });
pdfQueue.on('failed', (job, err) => { console.error(`[Queue] Job ${job.id} falhou - PDF: ${job.data.filename}`, err.message); });
pdfQueue.on('stalled', (job) => { console.warn(`[Queue] Job ${job.id} travado - PDF: ${job.data.filename}`); });

export async function addPdfToQueue(pdfData) 
{
    const job = await pdfQueue.add(JOB_TYPE, pdfData, 
    {
        priority: pdfData.priority || 5,
        jobId: pdfData.pdfId,
    });

    return job;
}

export async function getJobStatus(jobId) 
{
    const job = await pdfQueue.getJob(jobId);

    if (!job) return { status: 'not_found' };

    const state = await job.getState();
    const progress = job.progress();

    return { id: job.id, status: state, progress, data: job.data, failedReason: job.failedReason, finishedOn: job.finishedOn, processedOn: job.processedOn };
}

export async function pauseQueue() 
{
    await pdfQueue.pause();
    console.log('[Queue] Fila pausada');
}

export async function resumeQueue() 
{
    await pdfQueue.resume();
    console.log('[Queue] Fila retomada');
}

export async function cleanQueue()
{
    await pdfQueue.clean(24 * 3600 * 1000, 'completed');
    await pdfQueue.clean(7 * 24 * 3600 * 1000, 'failed');
    console.log('[Queue] Fila limpa');
}

export async function retryFailedJobs() 
{
    const failedJobs = await pdfQueue.getFailed();
    
    for (const job of failedJobs) 
    {
        console.log(`Reprocessando job falhado: ${job.id}`);
        await job.retry();
    }
    
    console.log(`[Queue] ${failedJobs.length} jobs falhados reprocessados`);
}

process.on('SIGTERM', async () => 
{
    console.log('[Queue] Encerrando fila...');
    await pdfQueue.close();
    process.exit(0);
});

export default pdfQueue;