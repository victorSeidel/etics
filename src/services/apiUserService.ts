// Serviço para comunicação com a API de usuários no backend

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface UserProfile {
    id: number;
    email: string;
    name: string;
    role: 'user' | 'admin';
    plan: string;
    planDisplayName: string;
    credits: number;
    creditsUsed: number;
    subscriptionStatus: 'active' | 'cancelled' | 'expired' | 'suspended';
    billingCycle?: 'monthly' | 'yearly';
    createdAt: string;
}

export interface UpdateProfileData {
    name?: string;
    email?: string;
}

export interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

export interface CreditBalance {
    available: number;
    used: number;
    total: number;
}

// Obter perfil do usuário
export async function getUserProfile(userId: number): Promise<UserProfile> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/users/${userId}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar perfil do usuário');
    }

    return response.json();
}

// Atualizar perfil do usuário
export async function updateUserProfile(userId: number, data: UpdateProfileData): Promise<UserProfile> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar perfil');
    }

    return response.json();
}

// Alterar senha do usuário
export async function changePassword(userId: number, data: ChangePasswordData): Promise<{ message: string }> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/users/${userId}/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao alterar senha');
    }

    return response.json();
}

// Obter saldo de créditos do usuário
export async function getCreditBalance(userId: number): Promise<CreditBalance> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/users/${userId}/credits`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar saldo de créditos');
    }

    return response.json();
}

// Verificar se o usuário tem créditos suficientes
export async function checkCredits(userId: number, amount: number = 1): Promise<{ hasCredits: boolean; available: number; required: number }> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/users/${userId}/check-credits`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao verificar créditos');
    }

    return response.json();
}

// Deletar conta do usuário
export async function deleteUserAccount(userId: number): Promise<{ message: string }> {
    const token = localStorage.getItem('token');

    const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao deletar conta');
    }

    return response.json();
}