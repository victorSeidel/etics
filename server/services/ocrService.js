import { createWorker } from 'tesseract.js';
import { PDFParse } from "pdf-parse";

import fs from 'fs/promises';
import { pool } from '../db.js';

import { sendProcessCompletedEmail } from './emailService.js';

const workerPool = [];
const MAX_WORKERS = process.env.OCR_WORKERS || 2;
let isInitialized = false;

async function initializeWorkerPool() 
{
    if (isInitialized) return;

    console.log(`[OCR] Inicializando pool com ${MAX_WORKERS} workers...`);

    for (let i = 0; i < MAX_WORKERS; i++) 
    {
        const worker = await createWorker('por', 1, 
        {
            logger: (m) => 
            {
                if (m.status === 'recognizing text') 
                {
                    console.log(`[OCR Worker ${i}] Progresso: ${Math.round(m.progress * 100)}%`);
                }
            },
        });
        workerPool.push(worker);
    }

    isInitialized = true;
    console.log('[OCR] Pool de workers inicializado');
}

function getWorker() { return workerPool[Math.floor(Math.random() * workerPool.length)]; }

async function processPage(imageBuffer, pageNumber) 
{
    const worker = getWorker();

    try 
    {
        const { data: { text } } = await worker.recognize(imageBuffer);
        return { pageNumber, text: `\n\n========== PÁGINA ${pageNumber} ==========\n\n${text}` };
    } 
    catch (error) 
    {
        console.error(`[OCR] Erro ao processar página ${pageNumber}:`, error);
        throw error;
    }
}

async function pdfPageToImage(pdfParser, pageNumber) 
{
    try 
    {
        const screenshotResult = await pdfParser.getScreenshot({ partial: [pageNumber], scale: 2.0, imageBuffer: true, imageDataUrl: false });

        if (!screenshotResult.pages || !screenshotResult.pages[0] || !screenshotResult.pages[0].data) 
        {
            throw new Error(`Falha ao gerar screenshot da página ${pageNumber}`);
        }

        return screenshotResult.pages[0].data;
    } 
    catch (error) 
    {
        console.error(`[OCR] Erro ao converter página ${pageNumber} para imagem:`, error);
        throw error;
    }
}

async function updatePdfProgress(pdfId, progress, currentPage, extractedText = null) 
{
    const client = await pool.connect();

    try 
    {
        const updates = { progress, current_page: currentPage };

        if (extractedText) updates.extracted_text = extractedText;

        const setClause = Object.keys(updates).map((key, idx) => `${key} = $${idx + 2}`).join(', ');

        const values = [pdfId, ...Object.values(updates)];

        await client.query(`UPDATE process_pdfs SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, values);
    } 
    finally 
    {
        client.release();
    }
}

async function updatePdfStatus(pdfId, status, errorMessage = null) 
{
    const client = await pool.connect();

    try 
    {
        await client.query(`UPDATE process_pdfs SET status = $2::text, error_message = $3, updated_at = CURRENT_TIMESTAMP,
            completed_at = CASE WHEN $2 IN ('concluido', 'erro') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = $1`, [pdfId, status || null, errorMessage]
        );
    } 
    finally 
    {
        client.release();
    }
}

async function updateProcessProgress(processId) 
{
    const client = await pool.connect();

    try 
    {
        const result = await client.query(`SELECT COUNT(*) as total_pdfs, SUM(CASE WHEN status = 'concluido' THEN 1 ELSE 0 END) as completed_pdfs,
            SUM(CASE WHEN status = 'erro' THEN 1 ELSE 0 END) as error_pdfs, AVG(progress) as avg_progress,
                STRING_AGG(CASE WHEN status = 'erro' THEN error_message ELSE NULL END, '; ') as error_messages FROM process_pdfs WHERE process_id = $1`,[processId]);

        const { total_pdfs, completed_pdfs, error_pdfs, avg_progress, error_messages } = result.rows[0];
        const overallProgress = Math.round(avg_progress || 0);

        let processStatus = 'processando';
        let processErrorMessage = null;

        if (error_pdfs > 0 && (parseInt(completed_pdfs) + parseInt(error_pdfs)) == parseInt(total_pdfs)) 
        {
            if (error_pdfs == total_pdfs) 
            {
                processStatus = 'erro';
                processErrorMessage = error_messages || 'Todos os PDFs falharam ao processar';
            } 
            else 
            {
                processStatus = 'concluido';
            }
        } 
        else if (completed_pdfs == total_pdfs) 
        {
            processStatus = 'concluido';
        }

        const completed = Number.isFinite(parseInt(completed_pdfs)) ? parseInt(completed_pdfs) : 0;
        const errors = Number.isFinite(parseInt(error_pdfs)) ? parseInt(error_pdfs) : 0;

        await client.query(`UPDATE processes SET progress = $2, processed_pdfs = $3, status = $4, error_message = $5, updated_at = CURRENT_TIMESTAMP, completed_at = CASE 
            WHEN $4 IN ('concluido', 'erro') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = $1`, 
                [processId, overallProgress, completed + errors, processStatus, processErrorMessage]);
    } 
    finally 
    {
        client.release();
    }
}

export async function processPdf(job) 
{
    const { pdfId, pdfPath, processId, filename } = job.data;

    await initializeWorkerPool();

    try 
    {
        console.log(`[OCR] Iniciando processamento de ${filename}`);

        await updatePdfStatus(pdfId, 'processando');

        const pdfBuffer = await fs.readFile(pdfPath);

        const pdfParser = new PDFParse({ data: pdfBuffer });
        const doc = await pdfParser.load();
        const totalPages = doc.numPages;

        console.log(`[OCR] PDF ${filename} tem ${totalPages} páginas`);

        const client = await pool.connect();
        await client.query('UPDATE process_pdfs SET page_count = $2 WHERE id = $1', [pdfId, totalPages]);
        client.release();

        const extractedTexts = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) 
        {
            try 
            {
                console.log(`[OCR] Processando página ${pageNum}/${totalPages} de ${filename}`);

                const imageBuffer = await pdfPageToImage(pdfParser, pageNum);

                const result = await processPage(imageBuffer, pageNum);
                extractedTexts.push(result.text);

                const progress = Math.round((pageNum / totalPages) * 100);
                await updatePdfProgress(pdfId, progress, pageNum);

                job.progress(progress);

                await updateProcessProgress(processId);

            } 
            catch (pageError) 
            {
                console.error(`[OCR] Erro ao processar página ${pageNum}:`, pageError);
                extractedTexts.push(`\n\n========== PÁGINA ${pageNum} ==========\n\n[Erro ao processar esta página]\n`);
            }
        }

        const fullText = extractedTexts.join('');

        await updatePdfProgress(pdfId, 100, totalPages, fullText);
        await updatePdfStatus(pdfId, 'concluido');

        await updateProcessProgress(processId, filename);

        await pdfParser.destroy();

        console.log(`[OCR] Processamento de ${filename} concluído com sucesso`);

        await notifyUser(processId);

        return { pdfId, filename, totalPages, textLength: fullText.length };

    } 
    catch (error) 
    {
        console.error(`[OCR] Erro ao processar ${filename}:`, error);

        await updatePdfStatus(pdfId, 'erro', error.message);

        await updateProcessProgress(processId);

        throw error;
    }
}

async function notifyUser(processId, filename)
{
    try 
    {
        const client = await pool.connect();
        const userQuery = await client.query(`SELECT u.email, u.name FROM users u INNER JOIN processes p ON p.user_id = u.id WHERE p.id = $1`, [processId]);
        client.release();

        if (userQuery.rows.length > 0) 
        {
            const { email, name } = userQuery.rows[0];
            await sendProcessCompletedEmail(email, name, processId, filename);
            console.log(`[E-MAIL] Notificação de conclusão enviada para ${email}`);
        } 
        else 
        {
            console.warn(`[E-MAIL] Nenhum usuário encontrado para o processo ${processId}`);
        }
    } 
    catch (mailError) 
    {
        console.error('[E-MAIL] Falha ao enviar notificação de conclusão:', mailError);
    }
}

export async function cleanup() 
{
    console.log('[OCR] Encerrando workers...');
    for (const worker of workerPool) 
    {
        await worker.terminate();
    }
    workerPool.length = 0;
    isInitialized = false;
    console.log('[OCR] Workers encerrados');
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);