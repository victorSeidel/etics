import OpenAI from 'openai';
import { pool } from '../db.js';
import { searchSimilarChunks, getEmbeddingStats } from './embeddingService.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_CONTEXT_WORDS = 4000;
const SEMANTIC_SEARCH_LIMIT = 5;
const MIN_SIMILARITY_THRESHOLD = 0.5;

export async function createConversation({ processId, userId, title = 'Nova Conversa' }) {
    const client = await pool.connect();

    try {
        // Verifica se o processo existe e pertence ao usuário
        const processResult = await client.query(
            'SELECT * FROM processes WHERE id = $1 AND user_id = $2',
            [processId, userId]
        );

        if (processResult.rows.length === 0) {
            throw new Error('Processo não encontrado ou acesso negado');
        }

        const process = processResult.rows[0];

        if (process.status !== 'concluido') {
            throw new Error('O processo precisa estar concluído para criar conversas');
        }

        // Verifica limite de 10 conversas por processo
        const countResult = await client.query(
            'SELECT COUNT(*) FROM process_conversations WHERE process_id = $1',
            [processId]
        );

        const conversationCount = parseInt(countResult.rows[0].count);

        if (conversationCount >= 10) {
            throw new Error('Limite de 10 conversas por processo atingido');
        }

        // Cria a conversa
        const result = await client.query(
            `INSERT INTO process_conversations (process_id, user_id, title)
             VALUES ($1, $2, $3)
             RETURNING id, process_id, user_id, title, message_count, created_at, updated_at`,
            [processId, userId, title]
        );

        return result.rows[0];

    }
    finally {
        client.release();
    }
}

export async function listConversations({ processId, userId }) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT id, process_id, user_id, title, message_count, created_at, updated_at
             FROM process_conversations
             WHERE process_id = $1 AND user_id = $2
             ORDER BY updated_at DESC`,
            [processId, userId]
        );

        return result.rows;

    }
    finally {
        client.release();
    }
}

export async function getConversation({ conversationId, userId }) {
    const client = await pool.connect();

    try {
        // Busca a conversa
        const convResult = await client.query(
            `SELECT c.*, p.name as process_name
             FROM process_conversations c
             JOIN processes p ON c.process_id = p.id
             WHERE c.id = $1 AND c.user_id = $2`,
            [conversationId, userId]
        );

        if (convResult.rows.length === 0) {
            throw new Error('Conversa não encontrada ou acesso negado');
        }

        // Busca as mensagens
        const messagesResult = await client.query(
            `SELECT id, conversation_id, role, content, created_at
             FROM process_chat_messages
             WHERE conversation_id = $1
             ORDER BY created_at ASC`,
            [conversationId]
        );

        return {
            ...convResult.rows[0],
            messages: messagesResult.rows
        };

    }
    finally {
        client.release();
    }
}

export async function renameConversation({ conversationId, userId, newTitle }) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `UPDATE process_conversations
             SET title = $1
             WHERE id = $2 AND user_id = $3
             RETURNING id, title`,
            [newTitle, conversationId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Conversa não encontrada ou acesso negado');
        }

        return result.rows[0];

    }
    finally {
        client.release();
    }
}

export async function deleteConversation({ conversationId, userId }) {
    const client = await pool.connect();

    try {
        const result = await client.query(
            `DELETE FROM process_conversations
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [conversationId, userId]
        );

        if (result.rows.length === 0) {
            throw new Error('Conversa não encontrada ou acesso negado');
        }

        return { success: true };

    }
    finally {
        client.release();
    }
}

export async function sendMessage({ conversationId, userId, message }) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const convResult = await client.query(
            `SELECT c.*, p.id as process_id, p.name as process_name, p.lawyer, p.defendants
             FROM process_conversations c
             JOIN processes p ON c.process_id = p.id
             WHERE c.id = $1 AND c.user_id = $2`,
            [conversationId, userId]
        );

        if (convResult.rows.length === 0) {
            throw new Error('Conversa não encontrada ou acesso negado');
        }

        const conversation = convResult.rows[0];

        // Verifica limite de 30 mensagens de usuário por conversa
        const messageCountResult = await client.query(
            `SELECT COUNT(*) FROM process_chat_messages
             WHERE conversation_id = $1 AND role = 'user'`,
            [conversationId]
        );

        const userMessageCount = parseInt(messageCountResult.rows[0].count);

        if (userMessageCount >= 30) {
            throw new Error('Limite de 30 mensagens por conversa atingido');
        }

        // Salva a mensagem do usuário
        const userMessageResult = await client.query(
            `INSERT INTO process_chat_messages (conversation_id, role, content)
             VALUES ($1, 'user', $2)
             RETURNING id, conversation_id, role, content, created_at`,
            [conversationId, message]
        );

        const userMessage = userMessageResult.rows[0];

        // Busca histórico de mensagens da conversa (últimas 10 mensagens para contexto)
        const historyResult = await client.query(
            `SELECT role, content, created_at
             FROM process_chat_messages
             WHERE conversation_id = $1
             ORDER BY created_at DESC
             LIMIT 10`,
            [conversationId]
        );

        const messageHistory = historyResult.rows.reverse(); // Ordem cronológica

        // Verifica se o processo tem embeddings gerados
        const embeddingStats = await getEmbeddingStats(conversation.process_id);

        if (embeddingStats.withoutEmbedding > 0) {
            console.log(`[CHAT] Aviso: ${embeddingStats.withoutEmbedding} PDFs sem embeddings no processo ${conversation.process_id}`);
        }
        if (embeddingStats.withEmbedding === 0) {
            throw new Error('Nenhum embedding encontrado para o processo. Por favor, aguarde o processamento completo dos documentos.');
        }

        // Busca chunks similares usando busca semântica vetorial
        console.log(`[CHAT] Buscando contexto relevante usando busca semântica...`);
        console.log(`[CHAT] PDFs com embeddings: ${embeddingStats.withEmbedding}/${embeddingStats.totalPdfs}`);
        console.log(`[CHAT] Total de chunks disponíveis: ${embeddingStats.totalChunks}`);
        console.log(`[CHAT] Threshold de similaridade mínima: 0.3 (30%)`);
        console.log(`[CHAT] Query: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);

        const similarChunks = await searchSimilarChunks(
            message,
            conversation.process_id,
            SEMANTIC_SEARCH_LIMIT,
            0.3 // Threshold reduzido
        );

        if (similarChunks.length === 0) {
            throw new Error(
                `Nenhum trecho similar encontrado nos documentos para sua pergunta. ` +
                `(${embeddingStats.totalChunks} trechos em ${embeddingStats.withEmbedding} PDFs disponíveis). ` +
                `Dica: Tente usar termos mais genéricos ou reformular a pergunta de forma diferente. ` +
                `O sistema busca por similaridade semântica, não por palavras exatas.`
            );
        }

        // Monta o contexto relevante a partir dos chunks encontrados
        // Limita o total de palavras para não exceder o limite do modelo
        let relevantContext = '';
        let totalWords = 0;

        for (const chunk of similarChunks) {
            const chunkText = `\n\n=== DOCUMENTO: ${chunk.filename} (Similaridade: ${(chunk.similarity * 100).toFixed(1)}%) ===\n\n${chunk.text}`;
            const chunkWords = chunkText.split(/\s+/).length;

            if (totalWords + chunkWords <= MAX_CONTEXT_WORDS) {
                relevantContext += chunkText;
                totalWords += chunkWords;
            } else {
                // Adiciona parcialmente se ainda houver espaço
                const remainingWords = MAX_CONTEXT_WORDS - totalWords;
                if (remainingWords > 100) { // Só adiciona se houver espaço significativo
                    const truncatedText = chunk.text.split(/\s+/).slice(0, remainingWords).join(' ');
                    relevantContext += `\n\n=== DOCUMENTO: ${chunk.filename} (Similaridade: ${(chunk.similarity * 100).toFixed(1)}%) ===\n\n${truncatedText}...`;
                }
                break;
            }
        }

        console.log(`[CHAT] Contexto montado: ${similarChunks.length} chunks, ${totalWords} palavras`);

        // Informações do processo
        const processInfo = `Informações do Processo:\n- Nome: ${conversation.process_name}\n- Advogado: ${conversation.lawyer || 'Não especificado'}\n- Réus: ${conversation.defendants ? conversation.defendants.join(', ') : 'Não especificados'}\n`;

        // Prepara o contexto para a IA
        const systemPrompt = `Você é um assistente jurídico especializado que responde perguntas sobre processos judiciais com base nos documentos fornecidos.

INSTRUÇÕES IMPORTANTES:
- Responda APENAS com base nas informações presentes nos documentos do processo.
- Se a informação não estiver nos documentos, diga claramente que não encontrou essa informação.
- Seja preciso, objetivo e profissional.
- Cite trechos específicos dos documentos quando relevante.
- Mantenha um tom formal e técnico, apropriado para o contexto jurídico.
- Não invente ou especule sobre informações que não estão nos documentos.
- Não ofereça outros serviços ou soluções ao final. Foque em responder a mensagem de forma precisa.

${processInfo}

CONTEXTO RELEVANTE DOS DOCUMENTOS (selecionado por busca semântica):
${relevantContext}`;

        // Prepara as mensagens para a API da OpenAI
        const messages = [
            { role: 'system', content: systemPrompt },
            ...messageHistory.slice(-8).map(m => ({ // Últimas 8 mensagens do histórico
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content
            }))
        ];

        // Chama a API da OpenAI
        console.log(`[CHAT] Enviando mensagem para OpenAI (conversa ${conversationId})...`);

        const completion = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: messages,
        });

        const assistantResponse = completion.choices[0].message.content;

        // Salva a resposta da IA
        const assistantMessageResult = await client.query(
            `INSERT INTO process_chat_messages (conversation_id, role, content)
             VALUES ($1, 'assistant', $2)
             RETURNING id, conversation_id, role, content, created_at`,
            [conversationId, assistantResponse]
        );

        const assistantMessage = assistantMessageResult.rows[0];

        await client.query('COMMIT');

        console.log(`[CHAT] Resposta gerada com sucesso para conversa ${conversationId}`);

        return {
            userMessage,
            assistantMessage,
            tokensUsed: completion.usage.total_tokens,
            model: completion.model
        };

    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(`[CHAT] Erro ao enviar mensagem na conversa ${conversationId}:`, error);
        throw error;
    }
    finally {
        client.release();
    }
}

export async function getMessages({ conversationId, userId, limit = 50, offset = 0 }) {
    const client = await pool.connect();

    try {
        // Verifica se a conversa pertence ao usuário
        const convResult = await client.query(
            'SELECT id FROM process_conversations WHERE id = $1 AND user_id = $2',
            [conversationId, userId]
        );

        if (convResult.rows.length === 0) {
            throw new Error('Conversa não encontrada ou acesso negado');
        }

        // Busca as mensagens
        const result = await client.query(
            `SELECT id, conversation_id, role, content, created_at
             FROM process_chat_messages
             WHERE conversation_id = $1
             ORDER BY created_at ASC
             LIMIT $2 OFFSET $3`,
            [conversationId, limit, offset]
        );

        return result.rows;

    }
    finally {
        client.release();
    }
}