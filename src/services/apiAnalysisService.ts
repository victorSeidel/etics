// Serviço para comunicação com a API de análises no backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Analysis {
    id: string;
    processId: string;
    userId: string;
    type: 'geral' | 'focada';
    focusAdvogado?: string;
    focusReu?: string;
    content: string;
    status: 'gerando' | 'concluida' | 'erro';
    errorMessage?: string;
    tokensUsed?: number;
    modelUsed?: string;
    progress?: number;
    totalSteps?: number;
    statusMessage?: string;
    createdAt: string;
    updatedAt: string;
}

export interface GenerateAnalysisRequest {
    processId: string;
    userId: string;
    type: 'geral' | 'focada';
    focusAdvogado?: string;
    focusReu?: string;
}

export interface AnalysisAvailability {
    geral: {
        available: boolean;
        used: boolean;
    };
    focada: {
        available: boolean;
        used: boolean;
    };
}

// Gerar nova análise
export async function generateAnalysis(data: GenerateAnalysisRequest): Promise<Analysis> {
    const response = await fetch(`${API_URL}/api/analyses/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao gerar análise');
    }

    const result = await response.json();
    return result;
}

// Listar análises de um processo
export async function getProcessAnalyses(processId: string, userId: string): Promise<Analysis[]> {
    const response = await fetch(`${API_URL}/api/analyses/${processId}?userId=${userId}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar análises');
    }

    const result = await response.json();
    return result.analyses;
}

// Verificar disponibilidade de análises
export async function getAnalysisAvailability(processId: string): Promise<AnalysisAvailability> {
    const response = await fetch(`${API_URL}/api/analyses/${processId}/availability`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao verificar disponibilidade');
    }

    const result = await response.json();
    return result.availability;
}

// Deletar uma análise
export async function deleteAnalysis(analysisId: string, userId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/analyses/${analysisId}?userId=${userId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar análise');
    }
}
