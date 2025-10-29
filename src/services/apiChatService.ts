// Serviço para comunicação com a API de chat no backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ChatMessage {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export interface Conversation {
    id: string;
    process_id: string;
    user_id: number;
    title: string;
    message_count: number;
    created_at: string;
    updated_at: string;
    messages?: ChatMessage[];
}

export interface ConversationWithMessages extends Conversation {
    process_name: string;
    messages: ChatMessage[];
}

export interface CreateConversationRequest {
    processId: string;
    title?: string;
}

export interface SendMessageRequest {
    conversationId: string;
    message: string;
}

export interface SendMessageResponse {
    success: boolean;
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    tokensUsed: number;
    model: string;
}

// Criar nova conversa
export async function createConversation(data: CreateConversationRequest): Promise<Conversation> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/chat/conversations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar conversa');
    }

    const result = await response.json();
    return result.conversation;
}

// Listar conversas de um processo
export async function listConversations(processId: string): Promise<Conversation[]> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/chat/conversations/${processId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao listar conversas');
    }

    const result = await response.json();
    return result.conversations;
}

// Buscar uma conversa específica com mensagens
export async function getConversation(conversationId: string): Promise<ConversationWithMessages> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/chat/conversation/${conversationId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar conversa');
    }

    const result = await response.json();
    return result.conversation;
}

// Renomear conversa
export async function renameConversation(conversationId: string, title: string): Promise<Conversation> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/chat/conversation/${conversationId}/rename`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao renomear conversa');
    }

    const result = await response.json();
    return result.conversation;
}

// Excluir conversa
export async function deleteConversation(conversationId: string): Promise<void> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/chat/conversation/${conversationId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao excluir conversa');
    }
}

// Enviar mensagem e receber resposta da IA
export async function sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/chat/conversation/${data.conversationId}/message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: data.message }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
    }

    const result = await response.json();
    return result;
}

// Buscar mensagens de uma conversa (com paginação)
export async function getMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/chat/conversation/${conversationId}/messages?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar mensagens');
    }

    const result = await response.json();
    return result.messages;
}
