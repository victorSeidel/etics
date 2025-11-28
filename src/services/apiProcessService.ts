// Serviço para comunicação com a API de processos no backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ProcessCreateData {
    userId: string;
    name: string;
    lawyer?: string;
    defendants?: string[];
}

export interface Tag {
    id: string;
    name: string;
    color: string;
}

export interface ProcessPdf {
    id: string;
    filename: string;
    fileSize: number;
    pageCount: number;
    currentPage: number;
    status: 'aguardando' | 'processando' | 'concluido' | 'erro';
    progress: number;
    extractedText?: string;
    errorMessage?: string;
    createdAt: string;
    completedAt?: string;
}

export interface Process {
    id: string;
    userId: string;
    name: string;
    lawyer?: string;
    defendants?: string[];
    status: 'aguardando' | 'processando' | 'concluido' | 'erro';
    progress: number;
    totalPdfs: number;
    processedPdfs: number;
    errorMessage?: string;
    createdAt: string;
    completedAt?: string;
    pdfs?: ProcessPdf[];
    isArchived?: boolean;
    isFavorite?: boolean;
    tags?: Tag[];
}

export interface ProcessStatusResponse {
    success: boolean;
    processId: string;
    status: string;
    progress: number;
    processedPdfs: number;
    totalPdfs: number;
    pdfs: ProcessPdf[];
}

// Criar novo processo
export async function createProcess(data: ProcessCreateData): Promise<Process> {
    const response = await fetch(`${API_URL}/api/processes`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar processo');
    }

    const result = await response.json();
    return result.process;
}

export async function uploadPdfs(processId: string, files: File[]): Promise<any[]> {
    const results: any[] = [];

    for (const file of files) {
        const formData = new FormData();
        formData.append('pdf', file);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000);

        try {
            const response = await fetch(`${API_URL}/api/processes/${processId}/single`, { method: 'POST', body: formData, signal: controller.signal });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json();
                results.push({ file: file.name, error: error.error || 'Erro desconhecido' });
                continue;
            }

            const result = await response.json();
            results.push(result);
        }
        catch (error) {
            results.push({ file: file.name, error: error.message });
        }

        if (files.length > 1) await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
}

// Upload de múltiplos PDFs
export async function uploadPdfsOld(processId: string, files: File[]): Promise<any> {
    const formData = new FormData();

    files.forEach(file => { formData.append('pdfs', file); });

    const response = await fetch(`${API_URL}/api/processes/${processId}/upload`, { method: 'POST', body: formData });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload dos PDFs');
    }

    return response.json();
}

// Listar processos do usuário
export async function listProcesses(userId: string): Promise<Process[]> {
    const response = await fetch(`${API_URL}/api/processes?userId=${userId}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao listar processos');
    }

    const result = await response.json();
    return result.processes;
}

// Obter detalhes de um processo
export async function getProcess(processId: string): Promise<Process> {
    const response = await fetch(`${API_URL}/api/processes/${processId}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar processo');
    }

    const result = await response.json();
    return result.process;
}

// Obter status e progresso em tempo real
export async function getProcessStatus(processId: string): Promise<ProcessStatusResponse> {
    const response = await fetch(`${API_URL}/api/processes/${processId}/status`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar status');
    }

    return response.json();
}

// Deletar processo
export async function deleteProcess(processId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/processes/${processId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar processo');
    }
}

// Download do texto extraído de um PDF
export function getDownloadUrl(processId: string, pdfId: string): string {
    return `${API_URL}/api/processes/${processId}/pdfs/${pdfId}/download`;
}

// Hook para polling de status (atualização automática)
export function useProcessPolling(processId: string, interval: number = 2000, onUpdate: (status: ProcessStatusResponse) => void, enabled: boolean = true) {
    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = () => {
        if (!enabled || intervalId) return;

        intervalId = setInterval(async () => {
            try {
                const status = await getProcessStatus(processId);
                onUpdate(status);

                // Para o polling quando completar ou dar erro
                if (status.status === 'concluido' || status.status === 'erro') {
                    stopPolling();
                }
            } catch (error) {
                console.error('Erro ao fazer polling:', error);
            }
        }, interval);
    };

    const stopPolling = () => {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    return { startPolling, stopPolling };
}

// Reprocessar um processo com erro
export async function retryProcess(processId: string): Promise<any> {
    const response = await fetch(`${API_URL}/api/processes/${processId}/retry`, {
        method: 'POST',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao reprocessar processo');
    }

    return response.json();
}

// Toggle archive status
export async function toggleArchive(processId: string): Promise<{ isArchived: boolean }> {
    const response = await fetch(`${API_URL}/api/processes/${processId}/archive`, {
        method: 'PATCH',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao arquivar processo');
    }

    return response.json();
}

// Toggle favorite status
export async function toggleFavorite(processId: string): Promise<{ isFavorite: boolean }> {
    const response = await fetch(`${API_URL}/api/processes/${processId}/favorite`, {
        method: 'PATCH',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao favoritar processo');
    }

    return response.json();
}

// Create a new tag
export async function createTag(userId: string, name: string, color: string): Promise<Tag> {
    const response = await fetch(`${API_URL}/api/processes/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name, color }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar tag');
    }

    const result = await response.json();
    return result.tag;
}

// Get all tags for a user
export async function getTags(userId: string): Promise<Tag[]> {
    const response = await fetch(`${API_URL}/api/processes/tags?userId=${userId}`);
    console.log(response);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao listar tags');
    }

    const result = await response.json();
    return result.tags;
}

// Add tag to process
export async function addTagToProcess(processId: string, tagId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/processes/${processId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao adicionar tag ao processo');
    }
}

// Remove tag from process
export async function removeTagFromProcess(processId: string, tagId: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/processes/${processId}/tags/${tagId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao remover tag do processo');
    }
}
