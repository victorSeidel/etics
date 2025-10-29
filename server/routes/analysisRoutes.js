import express from 'express';
import {
    generateAnalysis,
    getAnalyses,
    getProcessAnalyses,
    getAnalysisAvailability,
    deleteAnalysis
} from '../services/analysisService.js';

const router = express.Router();

// POST /api/analyses/generate - Gerar nova análise
router.post('/generate', async (req, res) => {
    try {
        const { processId, userId, type, focusTarget, focusType } = req.body;

        // Validação
        if (!processId || !userId || !type) {
            return res.status(400).json({
                error: 'processId, userId e type são obrigatórios'
            });
        }

        if (!['geral', 'focada'].includes(type)) {
            return res.status(400).json({
                error: 'type deve ser "geral" ou "focada"'
            });
        }

        if (type === 'focada' && (!focusTarget || !focusType)) {
            return res.status(400).json({
                error: 'Para análise focada, focusTarget e focusType são obrigatórios'
            });
        }

        if (focusType && !['advogado', 'reu'].includes(focusType)) {
            return res.status(400).json({
                error: 'focusType deve ser "advogado" ou "reu"'
            });
        }

        const result = await generateAnalysis({
            processId,
            userId,
            type,
            focusTarget,
            focusType
        });

        res.status(200).json(result);

    } catch (error) {
        console.error('Erro ao gerar análise:', error);

        // Retornar mensagem de erro específica
        if (error.message.includes('não encontrado') ||
            error.message.includes('acesso negado') ||
            error.message.includes('precisa estar concluído') ||
            error.message.includes('Já existe uma análise')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Erro ao gerar análise' });
    }
});

// GET /api/analyses/:processId - Listar análises de um processo
router.get('/all', async (req, res) => {
    try {
        const analyses = await getAnalyses();

        res.status(200).json({
            success: true,
            analyses
        });

    } catch (error) {
        console.error('Erro ao buscar análises:', error);
        res.status(500).json({ error: 'Erro ao buscar análises' });
    }
});

// GET /api/analyses/:processId - Listar análises de um processo
router.get('/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        const analyses = await getProcessAnalyses(processId, userId);

        res.status(200).json({
            success: true,
            analyses
        });

    } catch (error) {
        console.error('Erro ao buscar análises:', error);
        res.status(500).json({ error: 'Erro ao buscar análises' });
    }
});

// GET /api/analyses/:processId/availability - Verificar disponibilidade de análises
router.get('/:processId/availability', async (req, res) => {
    try {
        const { processId } = req.params;

        const availability = await getAnalysisAvailability(processId);

        res.status(200).json({
            success: true,
            availability
        });

    } catch (error) {
        console.error('Erro ao verificar disponibilidade:', error);
        res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
    }
});

// DELETE /api/analyses/:analysisId - Deletar uma análise
router.delete('/:analysisId', async (req, res) => {
    try {
        const { analysisId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId é obrigatório' });
        }

        const success = await deleteAnalysis(analysisId, userId);

        if (!success) {
            return res.status(404).json({ error: 'Análise não encontrada' });
        }

        res.status(200).json({
            success: true,
            message: 'Análise deletada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao deletar análise:', error);
        res.status(500).json({ error: 'Erro ao deletar análise' });
    }
});

export default router;
