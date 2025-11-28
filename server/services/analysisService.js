import OpenAI from 'openai';
import { pool } from '../db.js';

import { sendAnalysisCompletedEmail } from './emailService.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuração para processamento em chunks
const MAX_TOKENS_PER_REQUEST = 7000;
const TOKENS_PER_WORD = 1.5;
const MAX_WORDS_PER_CHUNK = Math.floor(MAX_TOKENS_PER_REQUEST / TOKENS_PER_WORD / 2);
const OVERLAP_WORDS = 200;

function splitTextIntoChunks(text, maxWords = MAX_WORDS_PER_CHUNK, overlap = OVERLAP_WORDS) {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const chunks = [];

    if (words.length === 0) return chunks;

    let startIndex = 0;
    while (startIndex < words.length) {
        const endIndex = Math.min(startIndex + maxWords, words.length);
        const chunk = words.slice(startIndex, endIndex).join(' ');
        chunks.push(chunk);

        if (endIndex >= words.length) break;

        startIndex = endIndex - overlap;
    }

    return chunks;
}

async function processInChunks(promptTemplate, processInfo, pdfsData, analysisId) {
    const allChunks = [];

    // Process each PDF separately to maintain source tracking
    for (const pdfData of pdfsData) {
        const pdfChunks = splitTextIntoChunks(pdfData.text);
        for (const chunk of pdfChunks) {
            allChunks.push({
                text: chunk,
                pdfName: pdfData.filename,
                pdfIndex: pdfData.index
            });
        }
    }

    console.log(`[ANÁLISE] Processando texto em ${allChunks.length} chunks de ${pdfsData.length} PDFs`);

    const client = await pool.connect();
    try {
        await client.query('UPDATE process_analyses SET total_steps = $1, progress = 0, status_message = $2 WHERE id = $3',
            [allChunks.length + 1, 'Iniciando processamento...', analysisId]);
    }
    finally {
        client.release();
    }

    const chunkAnalyses = [];
    let totalTokens = 0;

    for (let i = 0; i < allChunks.length; i++) {
        console.log(`Processando chunk ${i + 1}/${allChunks.length}...`);

        const updateClient = await pool.connect();
        try {
            await updateClient.query('UPDATE process_analyses SET progress = $1, status_message = $2 WHERE id = $3',
                [i, `Processando parte ${i + 1} de ${allChunks.length}...`, analysisId]);
        }
        finally {
            updateClient.release();
        }

        const currentChunk = allChunks[i];
        const chunkPrompt = `
        Analise este trecho abaixo de um documento jurídico e extraia informações RELEVANTES para o relatório final.
        
        IMPORTANTE: Ao mencionar qualquer informação específica, cite a fonte usando o formato [PDF: ${currentChunk.pdfName}]
        
        [PARTE ${i + 1} DE ${allChunks.length} DO DOCUMENTO - FONTE: ${currentChunk.pdfName}]
        ${currentChunk.text}
        [FIM DA PARTE ${i + 1}]

        EXEMPLO DE SAÍDA ESPERADO:
        {
            "dados_processuais": {
                "nomes_operacao": [],
                "numeros_processos": [],
                "investigadores": [],
                "datas_inicio": [],
                "escopo_mencoes": [],
                "fase_processual": []
            },
            "partes": {
                "reus": [],
                "cidades_reus": [],
                "situacoes_reus": [],
                "advogados": []
            },
            "tipificacao": {
                "crimes_investigados": [],
                "crimes_imputados": [],
                "denuncia_mp": [],
                "elementos_denuncia": [],
                "testemunhas": []
            },
            "medidas_cautelares": {
                "representacoes": [],
                "ordens_judiciais": [],
                "prisoes_flagrante": [],
                "apreensoes_eletronicos": []
            },
            "provas": {
                "busca_apreensao": [],
                "provas_apresentadas": [],
                "itens_pericia": [],
                "laudos_pericia": [],
                "acesso_acervo": []
            },
            "prazos": {
                "prazos_ra": [],
                "defesa_apresentada": [],
                "audiencias_designadas": [],
                "audiencias_realizadas": [],
                "interrupcoes": []
            },
            "vinculos": {
                "conexoes_entre_reus": []
            }
        }

        INSTRUÇÕES:
        - Extraia apenas informações EXPLÍCITAS do texto.
        - Se não encontrar algumas das informações, remova completamente a respectiva linha da informação.
        - Não invente ou deduza informações, apenas use o que está no texto.
        - Não adicione nenhum texto, comentário ou informação extra.
        - Preserve datas, números e nomes exatamente como aparecem.`
            ;

        try {
            const completion = await openai.chat.completions.create({
                model: 'gpt-5-nano',
                messages: [
                    { role: 'system', content: 'Você é um assistente jurídico especializado em análise de processos judiciais. Forneça análises detalhadas, precisas e bem estruturadas.' },
                    { role: 'user', content: chunkPrompt }
                ],
            });

            const chunkAnalysis = completion.choices[0].message.content;
            chunkAnalyses.push({ index: i + 1, content: chunkAnalysis });

            totalTokens += completion.usage.total_tokens;
        }
        catch (error) {
            console.error(`Erro ao processar chunk ${i + 1}:`, error);
            throw new Error(`Erro ao processar parte ${i + 1} do documento: ${error.message}`);
        }
    }

    if (chunkAnalyses.length === 1) {
        return { content: chunkAnalyses[0].content, totalTokens: totalTokens, model: 'gpt-5-nano' };
    }

    console.log('Consolidando análises dos chunks...');

    const consolidationClient = await pool.connect();
    try {
        await consolidationClient.query('UPDATE process_analyses SET progress = $1, status_message = $2 WHERE id = $3',
            [allChunks.length, 'Consolidando análises...', analysisId]);
    }
    finally {
        consolidationClient.release();
    }

    const consolidationPrompt = `
    ${promptTemplate}

    [INFORMAÇÕES DO PROCESSO]
    ${processInfo}
    
    IMPORTANTE: Ao consolidar as análises, PRESERVE todas as citações de fonte no formato [PDF: nome_do_arquivo.pdf]

    [ANÁLISES PARCIAIS]
    ${chunkAnalyses.map(chunk => `=== ANÁLISE DA PARTE ${chunk.index} ===\n${chunk.content}\n`).join('\n')}
    `;

    try {
        const finalCompletion = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
                { role: 'system', content: 'Você é um assistente jurídico especializado em consolidar análises de documentos jurídicos. Sua tarefa é combinar análises parciais em uma análise final coerente e completa.' },
                { role: 'user', content: consolidationPrompt }
            ],
        });

        totalTokens += finalCompletion.usage.total_tokens;

        console.log(`Análise consolidada concluída. Total de tokens usados: ${totalTokens}`);

        return { content: finalCompletion.choices[0].message.content, totalTokens: totalTokens, model: 'gpt-5-mini' };
    }
    catch (error) {
        console.error('Erro ao consolidar análises:', error);
        throw new Error(`Erro ao consolidar análises: ${error.message}`);
    }
}

export async function generateAnalysis({ processId, userId, type, focusAdvogado, focusReu }) {
    const client = await pool.connect();
    let analysisId = null;

    try {
        // 1. Verificar se o processo existe e pertence ao usuário
        const processResult = await client.query(
            'SELECT * FROM processes WHERE id = $1 AND user_id = $2',
            [processId, userId]
        );

        if (processResult.rows.length === 0) {
            throw new Error('Processo não encontrado ou acesso negado');
        }

        const process = processResult.rows[0];

        // Verificar se o processo foi concluído
        if (process.status !== 'concluido') {
            throw new Error('O processo precisa estar concluído para gerar análises');
        }

        // 2. Verificar se já existe uma análise desse tipo para esse processo
        const existingAnalysisResult = await client.query(
            'SELECT id, status FROM process_analyses WHERE process_id = $1 AND type = $2',
            [processId, type]
        );

        if (existingAnalysisResult.rows.length > 0) {
            const existingAnalysis = existingAnalysisResult.rows[0];

            if (existingAnalysis.status === 'concluida') {
                throw new Error(`Já existe uma análise do tipo '${type}' para este processo`);
            }

            if (existingAnalysis.status === 'gerando') {
                // Verificar se está "travada" há muito tempo (ex: 1 hora)
                // Por enquanto, apenas bloqueia
                throw new Error(`Já existe uma análise do tipo '${type}' sendo gerada neste momento`);
            }

            // Se existe uma análise com erro, remover antes de criar nova
            if (existingAnalysis.status === 'erro') {
                console.log(`Removendo análise anterior com status '${existingAnalysis.status}'`);
                await client.query(
                    'DELETE FROM process_analyses WHERE id = $1',
                    [existingAnalysis.id]
                );
            }
        }

        // 3. Obter o prompt configurado pelo admin
        const promptConfigName = type === 'geral' ? 'prompt_general_analysis' : 'prompt_focused_analysis';
        const promptResult = await client.query(
            'SELECT value FROM config WHERE name = $1',
            [promptConfigName]
        );

        if (promptResult.rows.length === 0) {
            throw new Error('Prompt de análise não configurado');
        }

        let promptTemplate = promptResult.rows[0].value;

        // Para análise focada, substituir os placeholders
        if (type === 'focada') {
            if (!focusAdvogado && !focusReu) {
                throw new Error('Para análise focada, é necessário especificar pelo menos focusAdvogado ou focusReu');
            }

            promptTemplate = promptTemplate.replace('{FOCUS_ADVOGADO}', focusAdvogado).replace('{FOCUS_REU}', focusReu);
        }

        // 4. Buscar todos os textos extraídos dos PDFs do processo
        const pdfsResult = await client.query(
            `SELECT original_filename, extracted_text
             FROM process_pdfs
             WHERE process_id = $1 AND status = 'concluido' AND extracted_text IS NOT NULL
             ORDER BY processing_order`,
            [processId]
        );

        if (pdfsResult.rows.length === 0) { throw new Error('Nenhum texto extraído encontrado para análise'); }

        const insertResult = await client.query(
            `INSERT INTO process_analyses
             (process_id, user_id, type, focus_advogado, focus_reu, prompt_used, status, analysis_content)
             VALUES ($1, $2, $3, $4, $5, $6, 'gerando', NULL)
             RETURNING id`,
            [processId, userId, type, focusAdvogado || null, focusReu || null, promptTemplate]
        );

        analysisId = insertResult.rows[0].id;
        console.log(`[ANÁLISE] Iniciada análise ${type} para processo ${processId} (ID: ${analysisId})`);

        client.release();

        try {
            // Prepare PDF data with metadata for source tracking
            const pdfsData = pdfsResult.rows.map((pdf, index) => ({
                filename: pdf.original_filename,
                text: pdf.extracted_text,
                index: index + 1
            }));

            const processInfo = `\nInformações do Processo:\n- Nome: ${process.name}\n- Advogado: ${process.lawyer || 'Não especificado'}\n- Réus: ${process.defendants ? process.defendants.join(', ') : 'Não especificados'}\n`;

            console.log(`[ANÁLISE] Enviando para OpenAI...`);

            const result = await processInChunks(promptTemplate, processInfo, pdfsData, analysisId);

            const analysisContent = result.content;
            const tokensUsed = result.totalTokens;
            const modelUsed = result.model;

            if (!analysisContent || analysisContent.trim().length === 0) {
                throw new Error('A análise gerada está vazia.');
            }

            // Reconectar para atualizar
            const updateClient = await pool.connect();
            try {
                // Atualizar para concluído
                await updateClient.query(
                    `UPDATE process_analyses
                     SET analysis_content = $1, status = 'concluida', tokens_used = $2, model_used = $3, updated_at = NOW()
                     WHERE id = $4`,
                    [analysisContent, tokensUsed, modelUsed, analysisId]
                );

                // Registrar uso de créditos
                await updateClient.query(
                    `INSERT INTO analysis_credits (process_id, user_id, analysis_type, credits_used)
                     VALUES ($1, $2, $3, 1)`,
                    [processId, userId, type]
                );

                console.log(`[ANÁLISE] Análise ${type} concluída com sucesso (ID: ${analysisId})`);

                // Enviar notificação (assíncrono)
                notifyUser(userId).catch(err => console.error('Erro ao notificar:', err));

                return {
                    success: true,
                    analysisId,
                    content: analysisContent,
                    tokensUsed,
                    modelUsed,
                    type,
                    focusAdvogado,
                    focusReu,
                    status: 'concluida'
                };

            } finally {
                updateClient.release();
            }

        } catch (processError) {
            console.error(`[ANÁLISE] Erro durante processamento (ID: ${analysisId}):`, processError);

            // Atualizar para erro
            const errorClient = await pool.connect();
            try {
                await errorClient.query(
                    `UPDATE process_analyses
                     SET status = 'erro', error_message = $1, updated_at = NOW()
                     WHERE id = $2`,
                    [processError.message, analysisId]
                );
            } finally {
                errorClient.release();
            }

            throw processError;
        }

    }
    catch (error) {
        console.error(`Erro ao gerar análise para processo ${processId}:`, error);

        throw error;
    }
}

export async function getAnalyses() {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT * FROM process_analyses ORDER BY created_at DESC`
        );

        return result.rows.map(row => ({
            id: row.id,
            processId: row.process_id,
            userId: row.user_id,
            type: row.type,
            focusAdvogado: row.focus_advogado,
            focusReu: row.focus_reu,
            content: row.analysis_content,
            status: row.status,
            errorMessage: row.error_message,
            tokensUsed: row.tokens_used,
            modelUsed: row.model_used,
            progress: row.progress,
            totalSteps: row.total_steps,
            statusMessage: row.status_message,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

    } finally {
        client.release();
    }
}

export async function getProcessAnalyses(processId, userId) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT * FROM process_analyses
             WHERE process_id = $1 AND user_id = $2
             ORDER BY created_at DESC`,
            [processId, userId]
        );

        return result.rows.map(row => ({
            id: row.id,
            processId: row.process_id,
            userId: row.user_id,
            type: row.type,
            focusAdvogado: row.focus_advogado,
            focusReu: row.focus_reu,
            content: row.analysis_content,
            status: row.status,
            errorMessage: row.error_message,
            tokensUsed: row.tokens_used,
            modelUsed: row.model_used,
            progress: row.progress,
            totalSteps: row.total_steps,
            statusMessage: row.status_message,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

    } finally {
        client.release();
    }
}

export async function getAnalysisAvailability(processId) {
    const client = await pool.connect();

    try {
        // Buscar apenas análises CONCLUÍDAS (análises com erro não contam)
        const result = await client.query(
            `SELECT type FROM process_analyses WHERE process_id = $1 AND status = 'concluida'`,
            [processId]
        );

        const usedAnalyses = result.rows.map(row => row.type);

        return {
            geral: {
                available: !usedAnalyses.includes('geral'),
                used: usedAnalyses.includes('geral')
            },
            focada: {
                available: !usedAnalyses.includes('focada'),
                used: usedAnalyses.includes('focada')
            }
        };

    } finally {
        client.release();
    }
}

export async function deleteAnalysis(analysisId, userId) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `DELETE FROM process_analyses WHERE id = $1 AND user_id = $2 RETURNING id`,
            [analysisId, userId]
        );

        return result.rows.length > 0;

    } finally {
        client.release();
    }
}

async function notifyUser(userId) {
    try {
        const client = await pool.connect();
        const userQuery = await client.query(`SELECT email, name FROM users WHERE id = $1`, [userId]);
        client.release();

        if (userQuery.rows.length > 0) {
            const { email, name } = userQuery.rows[0];
            await sendAnalysisCompletedEmail(email, name);
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