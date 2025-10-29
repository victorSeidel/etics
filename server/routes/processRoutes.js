import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { addPdfToQueue, getJobStatus } from '../services/queueService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
await fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: async (req, file, cb) => 
    {
        const processDir = path.join(uploadDir, req.body.processId || 'temp');
        await fs.mkdir(processDir, { recursive: true });
        cb(null, processDir);
    },
    filename: (req, file, cb) => 
    {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 1024 },
    fileFilter: (req, file, cb) => 
    {
        if (file.mimetype === 'application/pdf') cb(null, true);
        else cb(new Error('Apenas arquivos PDF são permitidos'));
    }
});

// POST /api/processes - Criar novo processo
router.post('/', async (req, res) => {
    const client = await pool.connect();

    try 
    {
        const { userId, name, lawyer, defendants } = req.body;

        // Validação
        if (!userId || !name) 
        {
            return res.status(400).json({ error: 'userId e name são obrigatórios' });
        }

        // Verifica se usuário tem créditos suficientes
        const userResult = await client.query(`SELECT credits_available FROM subscriptions WHERE user_id = $1 AND status = 'active'`, [userId]);

        if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        if (userResult.rows[0].credits < 1) return res.status(400).json({ error: 'Créditos insuficientes' });

        // Cria o processo
        const processResult = await client.query(`INSERT INTO processes (user_id, name, lawyer, defendants, status, progress)
            VALUES ($1, $2, $3, $4, 'aguardando', 0) RETURNING *`, [userId, name, lawyer || null, defendants || []]);

        const process = processResult.rows[0];

        res.status(201).json({
            success: true,
            process: {
                id: process.id,
                userId: process.user_id,
                name: process.name,
                lawyer: process.lawyer,
                defendants: process.defendants,
                status: process.status,
                progress: process.progress,
                totalPdfs: process.total_pdfs,
                processedPdfs: process.processed_pdfs,
                createdAt: process.created_at,
            }
        });

    } 
    catch (error) 
    {
        console.error('Erro ao criar processo:', error);
        res.status(500).json({ error: 'Erro ao criar processo' });
    } 
    finally 
    {
        client.release();
    }
});

// POST /api/processes/:id/upload - Upload de múltiplos PDFs
router.post('/:id/upload', upload.array('pdfs', 10), async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        // Verifica se o processo existe
        const processResult = await client.query(
            'SELECT * FROM processes WHERE id = $1',
            [processId]
        );

        if (processResult.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        const process = processResult.rows[0];

        // Verifica se usuário tem créditos suficientes
        const userResult = await client.query('SELECT credits_available FROM subscriptions WHERE user_id = $1', [process.user_id]);

        if (userResult.rows[0].credits < files.length) {
            // Remove arquivos enviados
            for (const file of files) {
                await fs.unlink(file.path).catch(() => {});
            }
            return res.status(400).json({ error: 'Créditos insuficientes para processar todos os PDFs' });
        }

        await client.query('BEGIN');

        // Deduz créditos
        await client.query(
            'UPDATE subscriptions SET credits_available = credits_available - 1 WHERE user_id = $1',
            [process.user_id]
        );

        await client.query(
            'UPDATE subscriptions SET credits_used = credits_used + 1 WHERE user_id = $1',
            [process.user_id]
        );

        // Insere PDFs no banco de dados e adiciona à fila
        const uploadedPdfs = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Insere PDF no banco
            const pdfResult = await client.query(
                `INSERT INTO process_pdfs
                 (process_id, filename, original_filename, file_size, file_path, processing_order, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'aguardando')
                 RETURNING *`,
                [
                    processId,
                    file.filename,
                    file.originalname,
                    file.size,
                    file.path,
                    i
                ]
            );

            const pdf = pdfResult.rows[0];

            // Adiciona à fila de processamento
            const job = await addPdfToQueue({
                pdfId: pdf.id,
                processId: processId,
                filename: pdf.original_filename,
                pdfPath: pdf.file_path,
                priority: 5,
            });

            uploadedPdfs.push({
                id: pdf.id,
                filename: pdf.original_filename,
                fileSize: pdf.file_size,
                status: pdf.status,
                jobId: job.id,
            });
        }

        // Atualiza contagem total de PDFs no processo
        await client.query(
            'UPDATE processes SET total_pdfs = $1, status = $2 WHERE id = $3',
            [files.length, 'processando', processId]
        );

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            processId,
            uploadedPdfs,
            message: `${files.length} PDF(s) enviado(s) e adicionado(s) à fila de processamento`,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao fazer upload de PDFs:', error);
        res.status(500).json({ error: 'Erro ao fazer upload de PDFs' });
    } finally {
        client.release();
    }
});

// GET /api/processes/all - Listar todos os processos
router.get('/all', async (req, res) => {
    const client = await pool.connect();

    try {

        const result = await client.query( `SELECT * FROM processes ORDER BY created_at DESC`);

        const processes = result.rows.map(p => ({
            id: p.id,
            userId: p.user_id,
            name: p.name,
            lawyer: p.lawyer,
            defendants: p.defendants,
            status: p.status,
            progress: p.progress,
            totalPdfs: p.total_pdfs,
            processedPdfs: p.processed_pdfs,
            errorMessage: p.error_message,
            createdAt: p.created_at,
            completedAt: p.completed_at,
        }));

        res.json({ success: true, processes });

    } catch (error) {
        console.error('Erro ao listar processos:', error);
        res.status(500).json({ error: 'Erro ao listar processos' });
    } finally {
        client.release();
    }
});

// GET /api/processes - Listar processos do usuário
router.get('/', async (req, res) => {
    const client = await pool.connect();

    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        const result = await client.query(
            `SELECT * FROM processes WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );

        const processes = result.rows.map(p => ({
            id: p.id,
            userId: p.user_id,
            name: p.name,
            lawyer: p.lawyer,
            defendants: p.defendants,
            status: p.status,
            progress: p.progress,
            totalPdfs: p.total_pdfs,
            processedPdfs: p.processed_pdfs,
            errorMessage: p.error_message,
            createdAt: p.created_at,
            completedAt: p.completed_at,
        }));

        res.json({ success: true, processes });

    } catch (error) {
        console.error('Erro ao listar processos:', error);
        res.status(500).json({ error: 'Erro ao listar processos' });
    } finally {
        client.release();
    }
});

// GET /api/processes/:id - Obter detalhes de um processo
router.get('/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;

        // Busca processo
        const processResult = await client.query(
            'SELECT * FROM processes WHERE id = $1',
            [processId]
        );

        if (processResult.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        const process = processResult.rows[0];

        // Busca PDFs do processo
        const pdfsResult = await client.query(
            `SELECT * FROM process_pdfs WHERE process_id = $1 ORDER BY processing_order`,
            [processId]
        );

        const pdfs = pdfsResult.rows.map(p => ({
            id: p.id,
            filename: p.original_filename,
            fileSize: p.file_size,
            pageCount: p.page_count,
            currentPage: p.current_page,
            status: p.status,
            progress: p.progress,
            extractedText: p.extracted_text,
            errorMessage: p.error_message,
            createdAt: p.created_at,
            completedAt: p.completed_at,
        }));

        res.json({
            success: true,
            process: {
                id: process.id,
                userId: process.user_id,
                name: process.name,
                lawyer: process.lawyer,
                defendants: process.defendants,
                status: process.status,
                progress: process.progress,
                totalPdfs: process.total_pdfs,
                processedPdfs: process.processed_pdfs,
                errorMessage: process.error_message,
                createdAt: process.created_at,
                completedAt: process.completed_at,
                pdfs,
            }
        });

    } catch (error) {
        console.error('Erro ao buscar processo:', error);
        res.status(500).json({ error: 'Erro ao buscar processo' });
    } finally {
        client.release();
    }
});

// GET /api/processes/:id/status - Obter status e progresso em tempo real
router.get('/:id/status', async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;

        // Busca processo
        const processResult = await client.query(
            'SELECT id, status, progress, processed_pdfs, total_pdfs FROM processes WHERE id = $1',
            [processId]
        );

        if (processResult.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        const process = processResult.rows[0];

        // Busca status de cada PDF
        const pdfsResult = await client.query(
            `SELECT id, original_filename, status, progress, current_page, page_count
             FROM process_pdfs
             WHERE process_id = $1
             ORDER BY processing_order`,
            [processId]
        );

        const pdfs = pdfsResult.rows.map(p => ({
            id: p.id,
            filename: p.original_filename,
            status: p.status,
            progress: p.progress,
            currentPage: p.current_page,
            pageCount: p.page_count,
        }));

        res.json({
            success: true,
            processId: process.id,
            status: process.status,
            progress: process.progress,
            processedPdfs: process.processed_pdfs,
            totalPdfs: process.total_pdfs,
            pdfs,
        });

    } catch (error) {
        console.error('Erro ao buscar status:', error);
        res.status(500).json({ error: 'Erro ao buscar status' });
    } finally {
        client.release();
    }
});

// DELETE /api/processes/:id - Deletar processo
router.delete('/:id', async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;

        // Busca arquivos para deletar
        const pdfsResult = await client.query(
            'SELECT file_path FROM process_pdfs WHERE process_id = $1',
            [processId]
        );

        // Deleta processo (cascade deleta os PDFs)
        const result = await client.query(
            'DELETE FROM processes WHERE id = $1 RETURNING *',
            [processId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        // Deleta arquivos físicos
        for (const pdf of pdfsResult.rows) {
            await fs.unlink(pdf.file_path).catch(() => {});
        }

        res.json({ success: true, message: 'Processo deletado com sucesso' });

    } catch (error) {
        console.error('Erro ao deletar processo:', error);
        res.status(500).json({ error: 'Erro ao deletar processo' });
    } finally {
        client.release();
    }
});

// GET /api/processes/:processId/pdfs/:pdfId/download - Download do texto extraído
router.get('/:processId/pdfs/:pdfId/download', async (req, res) => {
    const client = await pool.connect();

    try {
        const { processId, pdfId } = req.params;

        const result = await client.query(
            'SELECT original_filename, extracted_text FROM process_pdfs WHERE id = $1 AND process_id = $2',
            [pdfId, processId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'PDF não encontrado' });
        }

        const pdf = result.rows[0];

        if (!pdf.extracted_text) {
            return res.status(400).json({ error: 'Texto ainda não foi extraído' });
        }

        // Envia como arquivo de texto
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${pdf.original_filename}.txt"`);
        res.send(pdf.extracted_text);

    } catch (error) {
        console.error('Erro ao fazer download:', error);
        res.status(500).json({ error: 'Erro ao fazer download' });
    } finally {
        client.release();
    }
});

// POST /api/processes/:id/retry - Reprocessar um processo com erro
router.post('/:id/retry', async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;

        // Busca o processo
        const processResult = await client.query(
            'SELECT * FROM processes WHERE id = $1',
            [processId]
        );

        if (processResult.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        const process = processResult.rows[0];

        // Verifica se o processo está com erro
        if (process.status !== 'erro') {
            return res.status(400).json({ error: 'Apenas processos com erro podem ser reprocessados' });
        }

        // Busca PDFs com erro
        const pdfsResult = await client.query(
            `SELECT * FROM process_pdfs WHERE process_id = $1 AND status = 'erro' ORDER BY processing_order`,
            [processId]
        );

        if (pdfsResult.rows.length === 0) {
            return res.status(400).json({ error: 'Nenhum PDF com erro encontrado para reprocessar' });
        }

        await client.query('BEGIN');

        // Reseta status dos PDFs com erro
        for (const pdf of pdfsResult.rows) {
            await client.query(
                `UPDATE process_pdfs
                 SET status = 'aguardando',
                     error_message = NULL,
                     progress = 0,
                     current_page = 0,
                     extracted_text = NULL,
                     completed_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [pdf.id]
            );

            // Adiciona de volta à fila de processamento
            await addPdfToQueue({
                pdfId: pdf.id,
                processId: processId,
                filename: pdf.original_filename,
                pdfPath: pdf.file_path,
                priority: 5,
            });
        }

        // Reseta status do processo
        await client.query(
            `UPDATE processes
             SET status = 'processando',
                 error_message = NULL,
                 progress = 0,
                 completed_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [processId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `${pdfsResult.rows.length} PDF(s) adicionado(s) para reprocessamento`,
            retriedPdfs: pdfsResult.rows.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao reprocessar processo:', error);
        res.status(500).json({ error: 'Erro ao reprocessar processo' });
    } finally {
        client.release();
    }
});

export default router;
