import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { PDFParse } from "pdf-parse";

import fs from 'fs/promises';
import { pool } from '../db.js';

import { sendProcessCompletedEmail } from './emailService.js';
import { generateEmbeddingForPdf } from './embeddingService.js';

const workerPool = [];
const MAX_WORKERS = process.env.OCR_WORKERS || 8;
let isInitialized = false;
let currentWorkerIndex = 0;

async function initializeWorkerPool() {
    if (isInitialized) return;

    for (let i = 0; i < MAX_WORKERS; i++) {
        const worker = await createWorker('por', 1);
        await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ.,:;!?()- ' });
        workerPool.push(worker);
    }

    isInitialized = true;
    console.log('[OCR] Pool de workers inicializado');
}

function getWorker() {
    const worker = workerPool[currentWorkerIndex];
    currentWorkerIndex = (currentWorkerIndex + 1) % workerPool.length;
    return worker;
}

async function preprocessImage(imageBuffer) {
    let image = sharp(imageBuffer).resize({ width: 2000, withoutEnlargement: true });
    return await image.toBuffer();
}

async function processPage(imageBuffer, pageNumber) {
    const processedBuffer = await preprocessImage(imageBuffer);
    const worker = getWorker();

    try {
        const { data: { text } } = await worker.recognize(processedBuffer);
        return { pageNumber, text: `\n\n========== PÁGINA ${pageNumber} ==========\n\n${text}` };
    }
    catch (error) {
        console.error(`[OCR] Erro ao processar página ${pageNumber}:`, error);
        throw error;
    }
}

async function pdfPageToImage(pdfParser, pageNumber) {
    try {
        const screenshotResult = await pdfParser.getScreenshot({ partial: [pageNumber], scale: 1.0, imageBuffer: true, imageDataUrl: false });

        if (!screenshotResult.pages || !screenshotResult.pages[0] || !screenshotResult.pages[0].data) {
            throw new Error(`Falha ao gerar screenshot da página ${pageNumber}`);
        }

        return screenshotResult.pages[0].data;
    }
    catch (error) {
        console.error(`[OCR] Erro ao converter página ${pageNumber} para imagem:`, error);
        throw error;
    }
}

async function updatePdfProgress(pdfId, progress, processedPages, extractedText = null) {
    const client = await pool.connect();

    try {
        const updates = { progress, current_page: processedPages };

        if (extractedText) updates.extracted_text = extractedText;

        const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 2}`).join(', ');

        const values = [pdfId, ...Object.values(updates)];

        await client.query(`UPDATE process_pdfs SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, values);
    }
    finally {
        client.release();
    }
}

async function updatePdfStatus(pdfId, status, errorMessage = null) {
    const client = await pool.connect();

    try {
        await client.query(`UPDATE process_pdfs SET status = $2::text, error_message = $3, updated_at = CURRENT_TIMESTAMP,
            completed_at = CASE WHEN $2 IN ('concluido', 'erro') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = $1`, [pdfId, status || null, errorMessage]
        );
    }
    finally {
        client.release();
    }
}

async function updateProcessProgress(processId) {
    const client = await pool.connect();

    try {
        const result = await client.query(`SELECT COUNT(*) as total_pdfs, SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as completed_pdfs,
            SUM(CASE WHEN status = 'erro' THEN 1 ELSE 0 END) as error_pdfs, AVG(progress) as avg_progress,
                STRING_AGG(CASE WHEN status = 'erro' THEN error_message ELSE NULL END, '; ') as error_messages FROM process_pdfs WHERE process_id = $1`, [processId]);

        const { total_pdfs, completed_pdfs, error_pdfs, avg_progress, error_messages } = result.rows[0];
        const overallProgress = Math.round(avg_progress || 0);

        let processStatus = 'processando';
        let processErrorMessage = null;

        if (error_pdfs > 0 && (parseInt(completed_pdfs) + parseInt(error_pdfs)) == parseInt(total_pdfs)) {
            if (error_pdfs == total_pdfs) {
                processStatus = 'erro';
                processErrorMessage = error_messages || 'Todos os PDFs falharam ao processar';
                await notifyUser(processId);
            }
            else {
                processStatus = 'concluido';
            }
        }
        else if (completed_pdfs == total_pdfs) {
            processStatus = 'concluido';
            await notifyUser(processId);
        }

        const completed = Number.isFinite(parseInt(completed_pdfs)) ? parseInt(completed_pdfs) : 0;
        const errors = Number.isFinite(parseInt(error_pdfs)) ? parseInt(error_pdfs) : 0;

        await client.query(`UPDATE processes SET progress = $2, processed_pdfs = $3, status = $4, error_message = $5, updated_at = CURRENT_TIMESTAMP, completed_at = CASE 
            WHEN $4 IN ('concluido', 'erro') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = $1`,
            [processId, overallProgress, completed + errors, processStatus, processErrorMessage]);
    } finally {
        client.release();
    }
}

async function processPagesConcurrently(pdfParser, totalPages, pdfId, processId, job) {
    const results = new Array(totalPages);
    const queue = Array.from({ length: totalPages }, (_, i) => i + 1).reverse();
    let processedPages = 0;

    const updateInterval = 10000;
    let lastProgress = 0;

    const progressUpdater = setInterval(async () => {
        const currentProgress = Math.round((processedPages / totalPages) * 100);
        if (currentProgress >= lastProgress + 5 || currentProgress === 100) {
            try {
                await Promise.all([updatePdfProgress(pdfId, currentProgress, processedPages), job.progress(currentProgress), updateProcessProgress(processId)]);
                lastProgress = currentProgress;
            }
            catch (error) {
                console.error(`[OCR] Erro ao atualizar progresso intervalado:`, error);
            }
        }
    }, updateInterval);

    const concurrencyTasks = [];

    for (let i = 0; i < MAX_WORKERS; i++) {
        concurrencyTasks.push((async () => {
            while (queue.length > 0) {
                const pageNum = queue.pop();
                console.log(`[OCR] Processando página ${pageNum}/${totalPages}`);

                try {
                    const imageBuffer = await pdfPageToImage(pdfParser, pageNum);
                    const result = await processPage(imageBuffer, pageNum);
                    results[pageNum - 1] = result;
                }
                catch (pageError) {
                    console.error(`[OCR] Erro ao processar página ${pageNum}:`, pageError);
                    results[pageNum - 1] = { pageNumber: pageNum, text: `\n\n========== PÁGINA ${pageNum} ==========\n\n[Erro ao processar esta página]\n` };
                }

                processedPages++;
            }
        })());
    }

    await Promise.all(concurrencyTasks);
    clearInterval(progressUpdater);
    return results;
}

export async function processPdf(job) {
    const { pdfId, pdfPath, processId, filename } = job.data;

    await initializeWorkerPool();

    try {
        console.log(`[OCR] Iniciando processamento de ${filename}`);

        await updatePdfStatus(pdfId, 'processando');

        const pdfBuffer = await fs.readFile(pdfPath);

        const pdfParser = new PDFParse({ data: pdfBuffer });
        const doc = await pdfParser.load();
        const totalPages = doc.numPages;

        const client = await pool.connect();
        await client.query('UPDATE process_pdfs SET page_count = $2 WHERE id = $1', [pdfId, totalPages]);
        client.release();

        const results = await processPagesConcurrently(pdfParser, totalPages, pdfId, processId, job);

        const extractedTexts = results.sort((a, b) => a.pageNumber - b.pageNumber).map(result => result.text);

        const fullText = extractedTexts.join('');

        await updatePdfProgress(pdfId, 100, totalPages, fullText);
        await updatePdfStatus(pdfId, 'concluido');

        await updateProcessProgress(processId);

        // Gera embedding automaticamente após OCR bem-sucedido
        try {
            console.log(`[OCR] Gerando embedding para ${filename}...`);
            await generateEmbeddingForPdf(pdfId);
            console.log(`[OCR] Embedding gerado com sucesso para ${filename}`);
        } catch (embeddingError) {
            // Não falha o OCR se a geração de embedding falhar
            console.error(`[OCR] Erro ao gerar embedding para ${filename}:`, embeddingError.message);
            console.warn(`[OCR] O PDF foi processado com sucesso, mas o embedding não foi gerado. Execute o script de geração manual posteriormente.`);
        }

        await pdfParser.destroy();

        console.log(`[OCR] Processamento de ${filename} concluído com sucesso`);

        return { pdfId, filename, totalPages, textLength: fullText.length };

    }
    catch (error) {
        console.error(`[OCR] Erro ao processar ${filename}:`, error);

        await updatePdfStatus(pdfId, 'erro', error.message);

        await updateProcessProgress(processId);

        throw error;
    }
}

async function notifyUser(processId) {
    try {
        const client = await pool.connect();
        const userQuery = await client.query(`SELECT u.email, u.name FROM users u INNER JOIN processes p ON p.user_id = u.id WHERE p.id = $1`, [processId]);
        client.release();

        if (userQuery.rows.length > 0) {
            const { email, name } = userQuery.rows[0];
            await sendProcessCompletedEmail(email, name, processId);
            console.log(`[E-MAIL] Notificação de conclusão enviada para ${email}`);
        }
        else {
            console.warn(`[E-MAIL] Nenhum usuário encontrado para o processo ${processId}`);
        }
    }
    catch (mailError) {
        console.error('[E-MAIL] Falha ao enviar notificação de conclusão:', mailError);
    }
}

export async function cleanup() {
    console.log('[OCR] Encerrando workers...');
    for (const worker of workerPool) await worker.terminate();
    workerPool.length = 0;
    isInitialized = false;
    console.log('[OCR] Workers encerrados');
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);