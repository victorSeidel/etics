import OpenAI from 'openai';
import { pool } from '../db.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuração para processamento em chunks
const MAX_TOKENS_PER_REQUEST = 120000;
const TOKENS_PER_WORD = 1.3; // Aproximação média (inglês/português)
const MAX_WORDS_PER_CHUNK = Math.floor(MAX_TOKENS_PER_REQUEST / TOKENS_PER_WORD / 2); // Divide por 2 para deixar espaço para prompt e resposta
const OVERLAP_WORDS = 500; // Palavras de sobreposição entre chunks para manter contexto

function splitTextIntoChunks(text, maxWords = MAX_WORDS_PER_CHUNK, overlap = OVERLAP_WORDS) 
{
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const chunks = [];

    if (words.length === 0) 
    {
        return chunks;
    }

    let startIndex = 0;
    while (startIndex < words.length) 
    {
        const endIndex = Math.min(startIndex + maxWords, words.length);
        const chunk = words.slice(startIndex, endIndex).join(' ');
        chunks.push(chunk);

        // Se chegamos ao fim, sair do loop
        if (endIndex >= words.length) 
        {
            break;
        }

        // Próximo chunk começa com sobreposição
        startIndex = endIndex - overlap;
    }

    return chunks;
}

function countWords(text) 
{
    return text.split(/\s+/).filter(word => word.length > 0).length;
}

async function processInChunks(systemPrompt, userPrompt, fullText, model = 'gpt-5-nano') 
{
    const wordCount = countWords(fullText);

    console.log(`Texto possui ${wordCount} palavras`);

    // Se o texto for pequeno, processar de uma vez
    if (wordCount <= MAX_WORDS_PER_CHUNK) {
        console.log('Texto pequeno, processando em uma única requisição...');
        const completion = await openai.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `${userPrompt}\n\n${fullText}` }
            ],
        });

        return {
            content: completion.choices[0].message.content,
            totalTokens: completion.usage.total_tokens,
            model: completion.model
        };
    }

    // Texto grande - processar em chunks
    console.log('Texto grande, processando em chunks...');
    const chunks = splitTextIntoChunks(fullText);
    console.log(`Dividido em ${chunks.length} chunks`);

    const chunkAnalyses = [];
    let totalTokens = 0;
    let modelUsed = model;

    // Processar cada chunk
    for (let i = 0; i < chunks.length; i++) 
    {
        console.log(`Processando chunk ${i + 1}/${chunks.length}...`);

        const chunkPrompt = `${userPrompt}\n\n[PARTE ${i + 1} DE ${chunks.length} DO DOCUMENTO]\n\n${chunks[i]}\n\n[FIM DA PARTE ${i + 1}]`;

        try 
        {
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: chunkPrompt }
                ],
            });

            const chunkAnalysis = completion.choices[0].message.content;
            chunkAnalyses.push({
                index: i + 1,
                content: chunkAnalysis
            });

            totalTokens += completion.usage.total_tokens;
            modelUsed = completion.model;

        } 
        catch (error) 
        {
            console.error(`Erro ao processar chunk ${i + 1}:`, error);
            throw new Error(`Erro ao processar parte ${i + 1} do documento: ${error.message}`);
        }
    }

    // Se houver apenas um chunk (improvável neste ponto), retornar direto
    if (chunkAnalyses.length === 1) 
    {
        return {
            content: chunkAnalyses[0].content,
            totalTokens: totalTokens,
            model: modelUsed
        };
    }

    console.log('Consolidando análises dos chunks...');

    const consolidationPrompt = `Você recebeu análises parciais de um documento jurídico grande que foi dividido em ${chunks.length} partes. Sua tarefa é consolidar essas análises em uma análise única, coerente e abrangente.

IMPORTANTE:
- Combine as informações de todas as partes.
- Elimine somente redundâncias e repetições.
- Mantenha todos os pontos importantes e relevantes de cada parte. Não remova ou exclua informações essenciais para o entendimento da análise.
- Organize a análise de forma lógica e estruturada.
- Não adicione ou invente informações que não estejam nas análises parciais. Seja objetivo e realista com as análises já feitas.
- Não adicione saudações, comentários ou outros tipos de textos extras. Apenas faça a análise de forma direta e imparcial.
- Não seja pró-ativo, não ofereça outros serviços ou soluções ao final. Foque apenas em emitir a análise.

ANÁLISES PARCIAIS:

${chunkAnalyses.map(chunk => `=== ANÁLISE DA PARTE ${chunk.index} ===\n${chunk.content}\n`).join('\n')}

Forneça agora a análise consolidada final:`;

    try 
    {
        const finalCompletion = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'Você é um assistente jurídico especializado em consolidar análises de documentos jurídicos. Sua tarefa é combinar análises parciais em uma análise final coerente e completa.'
                },
                { role: 'user', content: consolidationPrompt }
            ],
        });

        totalTokens += finalCompletion.usage.total_tokens;

        console.log(`Análise consolidada concluída. Total de tokens usados: ${totalTokens}`);

        return {
            content: finalCompletion.choices[0].message.content,
            totalTokens: totalTokens,
            model: modelUsed
        };

    } 
    catch (error) 
    {
        console.error('Erro ao consolidar análises:', error);
        throw new Error(`Erro ao consolidar análises: ${error.message}`);
    }
}

export async function generateAnalysis({ processId, userId, type, focusTarget, focusType }) 
{
    const client = await pool.connect();
    let analysisId = null;

    try 
    {
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

        // 2. Verificar se já existe uma análise CONCLUÍDA desse tipo para esse processo
        // (análises com erro não contam e podem ser tentadas novamente)
        const existingAnalysisResult = await client.query(
            'SELECT id, status FROM process_analyses WHERE process_id = $1 AND type = $2',
            [processId, type]
        );

        if (existingAnalysisResult.rows.length > 0) {
            const existingAnalysis = existingAnalysisResult.rows[0];

            if (existingAnalysis.status === 'concluida') {
                throw new Error(`Já existe uma análise do tipo '${type}' para este processo`);
            }

            // Se existe uma análise com erro ou gerando, remover antes de criar nova
            if (existingAnalysis.status === 'erro' || existingAnalysis.status === 'gerando') {
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
            if (!focusTarget || !focusType) {
                throw new Error('Para análise focada, é necessário especificar focusTarget e focusType');
            }

            promptTemplate = promptTemplate
                .replace('{FOCUS_TARGET}', focusTarget)
                .replace('{FOCUS_TYPE}', focusType === 'advogado' ? 'advogado(a)' : 'réu/ré');
        }

        // 4. Buscar todos os textos extraídos dos PDFs do processo
        const pdfsResult = await client.query(
            `SELECT original_filename, extracted_text
             FROM process_pdfs
             WHERE process_id = $1 AND status = 'concluido' AND extracted_text IS NOT NULL
             ORDER BY processing_order`,
            [processId]
        );

        if (pdfsResult.rows.length === 0) {
            throw new Error('Nenhum texto extraído encontrado para análise');
        }

        // Combinar todos os textos extraídos
        const combinedTexts = pdfsResult.rows
            .map((pdf, index) => `\n\n=== DOCUMENTO ${index + 1}: ${pdf.original_filename} ===\n\n${pdf.extracted_text}`)
            .join('\n');

        // Adicionar informações do processo ao prompt
        const processInfo = `\nInformações do Processo:\n- Nome: ${process.name}\n- Advogado: ${process.lawyer || 'Não especificado'}\n- Réus: ${process.defendants ? process.defendants.join(', ') : 'Não especificados'}\n`;

        const userPrompt = `${promptTemplate}\n${processInfo}\n\nDOCUMENTOS DO PROCESSO:${combinedTexts}`;
        const systemPrompt = 'Você é um assistente jurídico especializado em análise de processos judiciais. Forneça análises detalhadas, precisas e bem estruturadas.';

        // 5. Criar registro temporário de análise com status 'gerando'
        // IMPORTANTE: Não inserir ainda no banco - só se a análise for bem-sucedida
        console.log(`Gerando análise ${type} para processo ${processId}...`);

        // 6. Processar análise (com suporte a chunks para textos grandes)
        const result = await processInChunks(
            systemPrompt,
            userPrompt,
            combinedTexts,
            'gpt-5-nano' // Modelo padrão, pode ser configurável
        );

        const analysisContent = result.content;
        const tokensUsed = result.totalTokens;
        const modelUsed = result.model;

        // 7. Validar se a análise tem conteúdo
        if (!analysisContent || analysisContent.trim().length === 0) {
            throw new Error('A análise gerada está vazia. Tente novamente.');
        }

        // 8. APENAS AGORA inserir no banco de dados (análise bem-sucedida)
        const analysisResult = await client.query(
            `INSERT INTO process_analyses
             (process_id, user_id, type, focus_target, focus_type, prompt_used, analysis_content, status, tokens_used, model_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'concluida', $8, $9)
             RETURNING id`,
            [processId, userId, type, focusTarget || null, focusType || null, promptTemplate, analysisContent, tokensUsed, modelUsed]
        );

        analysisId = analysisResult.rows[0].id;

        // 9. APENAS AGORA registrar uso de créditos (análise bem-sucedida e salva)
        await client.query(
            `INSERT INTO analysis_credits (process_id, user_id, analysis_type, credits_used)
             VALUES ($1, $2, $3, 1)`,
            [processId, userId, type]
        );

        console.log(`Análise ${type} gerada com sucesso para processo ${processId}`);

        return {
            success: true,
            analysisId,
            content: analysisContent,
            tokensUsed,
            modelUsed,
            type,
            focusTarget,
            focusType
        };

    } 
    catch (error) 
    {
        // Em caso de erro, NÃO salvar a análise no banco e NÃO debitar créditos
        console.error(`Erro ao gerar análise para processo ${processId}:`, error);

        // Se por algum motivo o analysisId já foi criado, deletar o registro
        if (analysisId) {
            try {
                await client.query('DELETE FROM process_analyses WHERE id = $1', [analysisId]);
            } catch (deleteError) {
                console.error('Erro ao deletar análise com falha:', deleteError);
            }
        }

        throw error;
    } finally {
        client.release();
    }
}

export async function getAnalyses() 
{
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
            focusTarget: row.focus_target,
            focusType: row.focus_type,
            content: row.analysis_content,
            status: row.status,
            errorMessage: row.error_message,
            tokensUsed: row.tokens_used,
            modelUsed: row.model_used,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

    } finally {
        client.release();
    }
}

export async function getProcessAnalyses(processId, userId) 
{
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
            focusTarget: row.focus_target,
            focusType: row.focus_type,
            content: row.analysis_content,
            status: row.status,
            errorMessage: row.error_message,
            tokensUsed: row.tokens_used,
            modelUsed: row.model_used,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));

    } finally {
        client.release();
    }
}

export async function getAnalysisAvailability(processId) 
{
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

export async function deleteAnalysis(analysisId, userId) 
{
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
