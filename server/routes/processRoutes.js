import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { addPdfToQueue } from '../services/queueService.js';
import format from 'pg-format';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'uploads');
await fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const processDir = path.join(uploadDir, req.params.id || 'temp');
        await fs.mkdir(processDir, { recursive: true });
        cb(null, processDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const fileFilter = (req, file, cb) => { if (file.mimetype === 'application/pdf') cb(null, true); else cb(new Error('Apenas PDFs permitidos'), false); };
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024, files: 10 }, fileFilter });

router.post('/', async (req, res) => {
    const client = await pool.connect();

    try {
        const { userId, name, lawyer, defendants } = req.body;

        // Validação
        if (!userId || !name) {
            return res.status(400).json({ error: 'userId e name são obrigatórios' });
        }

        // Verifica se usuário tem créditos suficientes
        const userResult = await client.query(`SELECT credits_available FROM subscriptions WHERE user_id = $1 AND status = 'active'`, [userId]);

        if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        if (userResult.rows[0].credits_available <= 0) return res.status(400).json({ error: 'Créditos insuficientes' });

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
    catch (error) {
        console.error('Erro ao criar processo:', error);
        res.status(500).json({ error: 'Erro ao criar processo' });
    }
    finally {
        client.release();
    }
});

router.post('/:id/upload', upload.array('pdfs', 10), async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        const processResult = await client.query('SELECT id, user_id FROM processes WHERE id = $1', [processId]);

        if (processResult.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        const process = processResult.rows[0];

        await client.query('BEGIN');

        // Calcular tamanho total atual dos arquivos do processo
        const currentSizeResult = await client.query('SELECT COALESCE(SUM(file_size), 0) as total_size FROM process_pdfs WHERE process_id = $1', [processId]);
        const currentTotalSize = parseInt(currentSizeResult.rows[0].total_size);

        // Calcular tamanho dos novos arquivos
        const newFilesSize = files.reduce((acc, file) => acc + file.size, 0);

        // Constante: 1 crédito a cada 500MB
        const BYTES_PER_CREDIT = 500 * 1024 * 1024;

        // Calcular créditos necessários
        const currentCredits = Math.ceil(currentTotalSize / BYTES_PER_CREDIT);
        const newTotalSize = currentTotalSize + newFilesSize;
        // Se o tamanho total for 0 (primeiro upload e arquivo vazio? improvável, mas evita 0 créditos se for o caso de lógica futura), 
        // mas Math.ceil(0) é 0. Se tivermos 1 byte, Math.ceil(small / big) = 1.
        // O mínimo deve ser 1 crédito se houver qualquer arquivo? 
        // A regra é "1 crédito a cada 500mb". 
        // Se total < 500mb -> 1 crédito.
        // Se total = 0 (novo processo), currentCredits = 0.
        // Se upload 10mb -> newTotal = 10mb -> newCredits = 1.
        // Diff = 1.
        const newCredits = Math.max(1, Math.ceil(newTotalSize / BYTES_PER_CREDIT));

        // Ajuste: Se for o primeiro upload, currentCredits será 0, então newCredits será pelo menos 1.
        // Se já tiver arquivos, currentCredits >= 1.
        const creditsToDeduct = newCredits - (currentTotalSize === 0 ? 0 : Math.ceil(currentTotalSize / BYTES_PER_CREDIT));

        if (creditsToDeduct > 0) {
            const userResult = await client.query('SELECT credits_available FROM subscriptions WHERE user_id = $1 FOR UPDATE', [process.user_id]);
            if (userResult.rows.length === 0 || userResult.rows[0].credits_available < creditsToDeduct) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Créditos insuficientes. Necessário: ${creditsToDeduct} crédito(s).` });
            }

            await client.query(`UPDATE subscriptions SET credits_available = credits_available - $1, credits_used = credits_used + $1, updated_at = NOW()
                WHERE user_id = $2`, [creditsToDeduct, process.user_id]);
        }

        const fileValues = files.map((file, index) => [
            processId,
            file.filename,
            file.originalname,
            file.size,
            file.path,
            index,
            'aguardando'
        ]);

        const pdfInsertQuery = format(`INSERT INTO process_pdfs (process_id, filename, original_filename, file_size, file_path, processing_order, status)
            VALUES %L RETURNING id, original_filename, file_path`, fileValues);

        const pdfResult = await client.query(pdfInsertQuery);
        const uploadedPdfs = pdfResult.rows;

        await client.query('UPDATE processes SET total_pdfs = total_pdfs + $1, status = $2, updated_at = NOW() WHERE id = $3', [files.length, 'processando', processId]);

        await client.query('COMMIT');

        (async () => {
            try {
                const queuePromises = uploadedPdfs.map(pdf => {
                    return addPdfToQueue({
                        pdfId: pdf.id,
                        processId,
                        filename: pdf.original_filename,
                        pdfPath: pdf.file_path,
                        priority: 5
                    });
                });

                await Promise.all(queuePromises);
            }
            catch (error) {
                console.error('[BACKGROUND ERRO] Erro ao adicionar à fila:', error);
            }
        })();

        res.status(200).json({
            success: true,
            processId,
            message: `${files.length} PDF(s) enviado(s) e sendo processados em background`
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro no upload bulk:', error); // Log mais específico
        res.status(500).json({ error: 'Erro ao fazer upload de PDFs' });
    }
    finally {
        client.release();
    }
});

router.post('/:id/single', upload.single('pdf'), async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;

        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

        const processResult = await client.query('SELECT id, user_id FROM processes WHERE id = $1 FOR UPDATE', [processId]);
        if (processResult.rows.length === 0) return res.status(404).json({ error: 'Processo não encontrado' });

        const process = processResult.rows[0];

        await client.query('BEGIN');

        // Calcular tamanho total atual dos arquivos do processo
        const currentSizeResult = await client.query('SELECT COALESCE(SUM(file_size), 0) as total_size FROM process_pdfs WHERE process_id = $1', [processId]);
        const currentTotalSize = parseInt(currentSizeResult.rows[0].total_size);

        // Constante: 1 crédito a cada 500MB
        const BYTES_PER_CREDIT = 500 * 1024 * 1024;

        const newTotalSize = currentTotalSize + file.size;

        // Créditos que deveriam ter sido cobrados até agora (se currentTotalSize for 0, é 0)
        const creditsChargedSoFar = currentTotalSize === 0 ? 0 : Math.ceil(currentTotalSize / BYTES_PER_CREDIT);

        // Novos créditos totais necessários
        const newTotalCredits = Math.max(1, Math.ceil(newTotalSize / BYTES_PER_CREDIT));

        const creditsToDeduct = newTotalCredits - creditsChargedSoFar;

        if (creditsToDeduct > 0) {
            const userResult = await client.query('SELECT credits_available FROM subscriptions WHERE user_id = $1 FOR UPDATE', [process.user_id]);
            if (userResult.rows.length === 0 || userResult.rows[0].credits_available < creditsToDeduct) {
                await client.query('ROLLBACK');
                // Remove o arquivo se falhar por crédito
                if (req.file && req.file.path) fs.unlink(req.file.path, () => { });
                return res.status(400).json({ error: `Créditos insuficientes. Necessário: ${creditsToDeduct} crédito(s).` });
            }

            await client.query(`UPDATE subscriptions SET credits_available = credits_available - $1, credits_used = credits_used + $1, updated_at = NOW()
                WHERE user_id = $2`, [creditsToDeduct, process.user_id]);
        }

        const pdfCountResult = await client.query('SELECT COUNT(*) AS total FROM process_pdfs WHERE process_id = $1', [processId]);
        const pdfCount = parseInt(pdfCountResult.rows[0].total, 10);

        const pdfInsertQuery = `INSERT INTO process_pdfs (process_id, filename, original_filename, file_size, file_path, processing_order, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, original_filename, file_path`;

        const pdfResult = await client.query(pdfInsertQuery, [processId, file.filename, file.originalname, file.size, file.path, pdfCount, 'aguardando']);

        const uploadedPdf = pdfResult.rows[0];

        await client.query(`UPDATE processes SET total_pdfs = total_pdfs + 1, status = 'processando', updated_at = NOW() WHERE id = $1`, [processId]);

        await client.query('COMMIT');

        (async () => {
            try {
                await addPdfToQueue({ pdfId: uploadedPdf.id, processId, filename: uploadedPdf.original_filename, pdfPath: uploadedPdf.file_path, priority: 5 });
            }
            catch (error) {
                console.error('[BACKGROUND ERRO] Erro ao adicionar à fila:', error);
            }
        })();

        res.status(200).json({ success: true, processId, message: `PDF "${file.originalname}" enviado e sendo processado em background` });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro no upload single:', error);
        if (req.file && req.file.path) fs.unlink(req.file.path, (unlinkError) => { if (unlinkError) console.error('Erro ao remover arquivo:', unlinkError); });
        res.status(500).json({ error: 'Erro ao fazer upload do PDF' });
    }
    finally {
        client.release();
    }
});

router.get('/all', async (req, res) => {
    const client = await pool.connect();

    try {

        const result = await client.query(`SELECT * FROM processes ORDER BY created_at DESC`);

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

        // Fetch tags for all processes
        const processIds = result.rows.map(p => p.id);
        const tagsResult = processIds.length > 0 ? await client.query(
            `SELECT pt.process_id, t.id, t.name, t.color 
             FROM process_tags pt 
             JOIN tags t ON pt.tag_id = t.id 
             WHERE pt.process_id = ANY($1)`,
            [processIds]
        ) : { rows: [] };

        // Group tags by process_id
        const tagsByProcess = {};
        tagsResult.rows.forEach(row => {
            if (!tagsByProcess[row.process_id]) {
                tagsByProcess[row.process_id] = [];
            }
            tagsByProcess[row.process_id].push({
                id: row.id,
                name: row.name,
                color: row.color
            });
        });

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
            isArchived: p.is_archived,
            isFavorite: p.is_favorite,
            tags: tagsByProcess[p.id] || []
        }));

        res.json({ success: true, processes });

    } catch (error) {
        console.error('Erro ao listar processos:', error);
        res.status(500).json({ error: 'Erro ao listar processos' });
    } finally {
        client.release();
    }
});

// Create a new tag
router.post('/tags', async (req, res) => {
    const client = await pool.connect();

    try {
        const { userId, name, color } = req.body;

        if (!userId || !name) {
            return res.status(400).json({ error: 'userId e name são obrigatórios' });
        }

        const result = await client.query(
            'INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) RETURNING *',
            [userId, name, color || '#000000']
        );

        const tag = result.rows[0];

        res.status(201).json({
            success: true,
            tag: {
                id: tag.id,
                name: tag.name,
                color: tag.color
            }
        });

    } catch (error) {
        console.error('Erro ao criar tag:', error);
        res.status(500).json({ error: 'Erro ao criar tag' });
    } finally {
        client.release();
    }
});

// Get all tags for a user
router.get('/tags', async (req, res) => {
    const client = await pool.connect();

    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        const result = await client.query(
            'SELECT * FROM tags WHERE user_id = $1 ORDER BY name',
            [userId]
        );

        const tags = result.rows.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color
        }));

        res.json({ success: true, tags });

    } catch (error) {
        console.error('Erro ao listar tags:', error);
        res.status(500).json({ error: 'Erro ao listar tags' });
    } finally {
        client.release();
    }
});

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

        // Fetch tags for this process
        const tagsResult = await client.query(
            `SELECT t.id, t.name, t.color 
             FROM process_tags pt 
             JOIN tags t ON pt.tag_id = t.id 
             WHERE pt.process_id = $1`,
            [processId]
        );

        const tags = tagsResult.rows.map(t => ({
            id: t.id,
            name: t.name,
            color: t.color
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
                isArchived: process.is_archived,
                isFavorite: process.is_favorite,
                tags,
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
            await fs.unlink(pdf.file_path).catch(() => { });
        }

        res.json({ success: true, message: 'Processo deletado com sucesso' });

    } catch (error) {
        console.error('Erro ao deletar processo:', error);
        res.status(500).json({ error: 'Erro ao deletar processo' });
    } finally {
        client.release();
    }
});

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

// Toggle archive status
router.patch('/:id/archive', async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;

        const result = await client.query(
            'UPDATE processes SET is_archived = NOT is_archived WHERE id = $1 RETURNING is_archived',
            [processId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        res.json({ success: true, isArchived: result.rows[0].is_archived });

    } catch (error) {
        console.error('Erro ao arquivar processo:', error);
        res.status(500).json({ error: 'Erro ao arquivar processo' });
    } finally {
        client.release();
    }
});

// Toggle favorite status
router.patch('/:id/favorite', async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;

        const result = await client.query(
            'UPDATE processes SET is_favorite = NOT is_favorite WHERE id = $1 RETURNING is_favorite',
            [processId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Processo não encontrado' });
        }

        res.json({ success: true, isFavorite: result.rows[0].is_favorite });

    } catch (error) {
        console.error('Erro ao favoritar processo:', error);
        res.status(500).json({ error: 'Erro ao favoritar processo' });
    } finally {
        client.release();
    }
});

// Add tag to process
router.post('/:id/tags', async (req, res) => {
    const client = await pool.connect();

    try {
        const processId = req.params.id;
        const { tagId } = req.body;

        if (!tagId) {
            return res.status(400).json({ error: 'tagId é obrigatório' });
        }

        await client.query(
            'INSERT INTO process_tags (process_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [processId, tagId]
        );

        res.json({ success: true, message: 'Tag adicionada ao processo' });

    } catch (error) {
        console.error('Erro ao adicionar tag ao processo:', error);
        res.status(500).json({ error: 'Erro ao adicionar tag ao processo' });
    } finally {
        client.release();
    }
});

// Remove tag from process
router.delete('/:id/tags/:tagId', async (req, res) => {
    const client = await pool.connect();

    try {
        const { id: processId, tagId } = req.params;

        await client.query(
            'DELETE FROM process_tags WHERE process_id = $1 AND tag_id = $2',
            [processId, tagId]
        );

        res.json({ success: true, message: 'Tag removida do processo' });

    } catch (error) {
        console.error('Erro ao remover tag do processo:', error);
        res.status(500).json({ error: 'Erro ao remover tag do processo' });
    } finally {
        client.release();
    }
});

export default router;