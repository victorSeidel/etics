import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
    createConversation,
    listConversations,
    getConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
    getMessages
} from '../services/chatService.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

/**
 * POST /api/chat/conversations
 * Cria uma nova conversa para um processo
 */
router.post('/conversations', async (req, res) => {
    try {
        const { processId, title } = req.body;
        const userId = req.user.id;

        if (!processId) {
            return res.status(400).json({ error: 'processId é obrigatório' });
        }

        const conversation = await createConversation({
            processId,
            userId,
            title: title || 'Nova Conversa'
        });

        res.status(201).json({
            success: true,
            conversation
        });

    } catch (error) {
        console.error('Erro ao criar conversa:', error);
        res.status(error.message.includes('não encontrado') || error.message.includes('acesso negado') ? 404 :
                   error.message.includes('Limite') ? 400 :
                   error.message.includes('precisa estar concluído') ? 400 : 500)
           .json({ error: error.message });
    }
});

/**
 * GET /api/chat/conversations/:processId
 * Lista todas as conversas de um processo
 */
router.get('/conversations/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const userId = req.user.id;

        const conversations = await listConversations({
            processId,
            userId
        });

        res.json({
            success: true,
            conversations
        });

    } catch (error) {
        console.error('Erro ao listar conversas:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/chat/conversation/:conversationId
 * Busca uma conversa específica com todas as mensagens
 */
router.get('/conversation/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const conversation = await getConversation({
            conversationId,
            userId
        });

        res.json({
            success: true,
            conversation
        });

    } catch (error) {
        console.error('Erro ao buscar conversa:', error);
        res.status(error.message.includes('não encontrada') || error.message.includes('acesso negado') ? 404 : 500)
           .json({ error: error.message });
    }
});

/**
 * PUT /api/chat/conversation/:conversationId/rename
 * Renomeia uma conversa
 */
router.put('/conversation/:conversationId/rename', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { title } = req.body;
        const userId = req.user.id;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Título é obrigatório' });
        }

        const conversation = await renameConversation({
            conversationId,
            userId,
            newTitle: title
        });

        res.json({
            success: true,
            conversation
        });

    } catch (error) {
        console.error('Erro ao renomear conversa:', error);
        res.status(error.message.includes('não encontrada') || error.message.includes('acesso negado') ? 404 : 500)
           .json({ error: error.message });
    }
});

/**
 * DELETE /api/chat/conversation/:conversationId
 * Exclui uma conversa
 */
router.delete('/conversation/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;

        const result = await deleteConversation({
            conversationId,
            userId
        });

        res.json({
            success: true,
            message: 'Conversa excluída com sucesso'
        });

    } catch (error) {
        console.error('Erro ao excluir conversa:', error);
        res.status(error.message.includes('não encontrada') || error.message.includes('acesso negado') ? 404 : 500)
           .json({ error: error.message });
    }
});

/**
 * POST /api/chat/conversation/:conversationId/message
 * Envia uma mensagem e recebe resposta da IA
 */
router.post('/conversation/:conversationId/message', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { message } = req.body;
        const userId = req.user.id;

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: 'Mensagem é obrigatória' });
        }

        if (message.length > 5000) {
            return res.status(400).json({ error: 'Mensagem muito longa (máximo 5000 caracteres)' });
        }

        const result = await sendMessage({
            conversationId,
            userId,
            message: message.trim()
        });

        res.json({
            success: true,
            userMessage: result.userMessage,
            assistantMessage: result.assistantMessage,
            tokensUsed: result.tokensUsed,
            model: result.model
        });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(error.message.includes('não encontrada') || error.message.includes('acesso negado') ? 404 :
                   error.message.includes('Limite') ? 400 :
                   error.message.includes('Nenhum texto extraído') ? 400 : 500)
           .json({ error: error.message });
    }
});

/**
 * GET /api/chat/conversation/:conversationId/messages
 * Busca mensagens de uma conversa (com paginação)
 */
router.get('/conversation/:conversationId/messages', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const messages = await getMessages({
            conversationId,
            userId,
            limit,
            offset
        });

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(error.message.includes('não encontrada') || error.message.includes('acesso negado') ? 404 : 500)
           .json({ error: error.message });
    }
});

export default router;
