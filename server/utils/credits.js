import { pool } from "../db.js";
import { getAsaasSubscription } from '../services/asaasService.js';

export const checkCredits = async (userId, amount = 1) => {
    try {
        const result = await pool.query(
            `SELECT s.credits_available, s.status, p.display_name as plan_name
             FROM subscriptions s
             JOIN plans p ON s.plan_id = p.id
             WHERE s.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return {
                hasCredits: false,
                available: 0,
                message: "Assinatura não encontrada"
            };
        }

        const subscription = result.rows[0];

        if (subscription.status !== 'active') {
            return {
                hasCredits: false,
                available: subscription.credits_available,
                message: `Assinatura ${subscription.status}`
            };
        }

        const hasCredits = subscription.credits_available >= amount;

        return {
            hasCredits,
            available: subscription.credits_available,
            message: hasCredits ? null : "Créditos insuficientes"
        };
    }
    catch (error) {
        console.error("Erro ao verificar créditos:", error);
        throw error;
    }
};

export const deductCredits = async (userId, amount, description, relatedEntity = null, relatedEntityId = null) => {
    try {
        // Verificar se tem créditos
        const check = await checkCredits(userId, amount);
        if (!check.hasCredits) {
            return {
                success: false,
                remainingCredits: check.available,
                message: check.message
            };
        }

        // Iniciar transação
        await pool.query('BEGIN');

        // Deduzir créditos
        const result = await pool.query(
            `UPDATE subscriptions
             SET credits_available = credits_available - $1,
                 credits_used = credits_used + $1
             WHERE user_id = $2
             RETURNING id, credits_available`,
            [amount, userId]
        );

        const subscription = result.rows[0];

        // Registrar transação
        await pool.query(
            `INSERT INTO credit_transactions
             (user_id, subscription_id, amount, type, description, related_entity, related_entity_id)
             VALUES ($1, $2, $3, 'debit', $4, $5, $6)`,
            [userId, subscription.id, amount, description, relatedEntity, relatedEntityId]
        );

        await pool.query('COMMIT');

        return {
            success: true,
            remainingCredits: subscription.credits_available,
            message: "Créditos deduzidos com sucesso"
        };
    }
    catch (error) {
        await pool.query('ROLLBACK');
        console.error("Erro ao deduzir créditos:", error);
        throw error;
    }
};

export const addCredits = async (userId, amount, description, type = 'credit') => {
    try {
        // Validar tipo
        const validTypes = ['credit', 'refund', 'bonus'];
        if (!validTypes.includes(type)) {
            throw new Error(`Tipo inválido: ${type}`);
        }

        // Iniciar transação
        await pool.query('BEGIN');

        // Adicionar créditos
        const result = await pool.query(
            `UPDATE subscriptions
             SET credits_available = credits_available + $1
             WHERE user_id = $2
             RETURNING id, credits_available`,
            [amount, userId]
        );

        if (result.rows.length === 0) {
            await pool.query('ROLLBACK');
            throw new Error("Assinatura não encontrada");
        }

        const subscription = result.rows[0];

        // Registrar transação
        await pool.query(
            `INSERT INTO credit_transactions
             (user_id, subscription_id, amount, type, description)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, subscription.id, amount, type, description]
        );

        await pool.query('COMMIT');

        return {
            success: true,
            totalCredits: subscription.credits_available
        };
    }
    catch (error) {
        await pool.query('ROLLBACK');
        console.error("Erro ao adicionar créditos:", error);
        throw error;
    }
};

export const refundCredits = async (userId, amount, description) => {
    return addCredits(userId, amount, description, 'refund');
};

export const requireCredits = (creditsRequired = 1) => {
    return async (req, res, next) => {
        try {
            const check = await checkCredits(req.user.id, creditsRequired);

            if (!check.hasCredits) {
                return res.status(403).json({
                    error: check.message,
                    available: check.available,
                    required: creditsRequired
                });
            }

            // Adicionar informações de créditos ao request
            req.credits = {
                available: check.available,
                required: creditsRequired
            };

            next();
        }
        catch (error) {
            console.error("Erro ao verificar créditos:", error);
            res.status(500).json({ error: "Erro ao verificar créditos" });
        }
    };
};

export const getCreditBalance = async (userId) => {
    try {
        const result = await pool.query(
            `SELECT credits_available, credits_used,
                    (credits_available + credits_used) as total_credits
             FROM subscriptions
             WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return { available: 0, used: 0, total: 0 };
        }

        const balance = result.rows[0];
        return {
            available: balance.credits_available,
            used: balance.credits_used,
            total: balance.total_credits
        };
    }
    catch (error) {
        console.error("Erro ao obter saldo de créditos:", error);
        throw error;
    }
};

export const renewCredits = async () => {
    try {
        await pool.query('BEGIN');

        // Buscar assinaturas ativas que precisam de renovação
        const result = await pool.query(`
            SELECT s.id, s.user_id, s.plan_id, s.billing_cycle, 
                   p.credits_per_month, p.display_name 
            FROM subscriptions s 
            JOIN plans p ON s.plan_id = p.id
            WHERE s.status = 'active' 
              AND s.current_period_end <= CURRENT_TIMESTAMP`);

        for (const subscription of result.rows) {
            // Calcular créditos baseado no ciclo de cobrança
            // "mensal" = credits_per_month, "anual" = credits_per_month * 12
            const creditsToAdd = subscription.billing_cycle === 'anual'
                ? subscription.credits_per_month * 12
                : subscription.credits_per_month;

            // Determinar o incremento de período baseado no ciclo
            const periodIncrement = subscription.billing_cycle === 'anual'
                ? '1 year'
                : '1 month';

            // Renovar créditos e atualizar o próximo período
            await pool.query(`
                UPDATE subscriptions 
                SET credits_available = credits_available + $1,
                    current_period_end = current_period_end + INTERVAL '${periodIncrement}'
                WHERE id = $2`,
                [creditsToAdd, subscription.id]);

            // Registrar transação com descrição apropriada
            const description = subscription.billing_cycle === 'anual'
                ? `Renovação anual - ${subscription.display_name}`
                : `Renovação mensal - ${subscription.display_name}`;

            await pool.query(`
                INSERT INTO credit_transactions 
                (user_id, subscription_id, amount, type, description) 
                VALUES ($1, $2, $3, 'credit', $4)`,
                [subscription.user_id, subscription.id, creditsToAdd, description]);

            console.log(`[CREDITS] Renovação ${subscription.billing_cycle} processada: ${creditsToAdd} créditos para usuário ${subscription.user_id}`);
        }

        await pool.query('COMMIT');

        return { success: true, renewed: result.rows.length };
    }
    catch (error) {
        await pool.query('ROLLBACK');
        console.error("Erro ao renovar créditos:", error);
        throw error;
    }
};

// Manter compatibilidade com código antigo (deprecated)
export const renewMonthlyCredits = renewCredits;

// ============================================
// Sincronização de Status com ASAAS
// ============================================

// Mapear status do ASAAS para status local
const mapAsaasStatusToLocal = (asaasStatus) => {
    const statusMap = {
        'ACTIVE': { status: 'active', is_active: true },
        'INACTIVE': { status: 'suspended', is_active: false },
        'EXPIRED': { status: 'expired', is_active: false }
    };
    return statusMap[asaasStatus] || { status: 'suspended', is_active: false };
};

// Sincronizar status de uma assinatura específica
export const syncSubscriptionStatus = async (subscriptionId, asaasSubscriptionId) => {
    try {
        // Buscar status no ASAAS
        const asaasData = await getAsaasSubscription(asaasSubscriptionId);

        // Mapear status
        const { status, is_active } = mapAsaasStatusToLocal(asaasData.status);

        // Atualizar no banco
        await pool.query(
            `UPDATE subscriptions 
             SET status = $1, is_active = $2 
             WHERE id = $3`,
            [status, is_active, subscriptionId]
        );

        console.log(`[SYNC] Assinatura ${subscriptionId} atualizada: ${status} (is_active: ${is_active})`);

        return { success: true, status, is_active };
    } catch (error) {
        // Se a assinatura não foi encontrada no ASAAS, marcar como cancelada
        if (error.message.includes('404') || error.message.includes('Not Found') || error.message.includes('não encontrada')) {
            await pool.query(
                `UPDATE subscriptions 
                 SET status = 'cancelled', is_active = FALSE 
                 WHERE id = $1`,
                [subscriptionId]
            );
            console.log(`[SYNC] Assinatura ${subscriptionId} não encontrada no ASAAS - marcada como cancelada`);
            return { success: true, status: 'cancelled', is_active: false };
        }

        console.error(`[SYNC] Erro ao sincronizar assinatura ${subscriptionId}:`, error.message);
        throw error;
    }
};

// Sincronizar todas as assinaturas com ASAAS ID
export const syncAllSubscriptionsStatus = async () => {
    try {
        // Buscar todas as assinaturas que têm asaas_subscription_id
        const result = await pool.query(
            `SELECT id, asaas_subscription_id, user_id 
             FROM subscriptions 
             WHERE asaas_subscription_id IS NOT NULL`
        );

        let synced = 0;
        let failed = 0;

        for (const subscription of result.rows) {
            try {
                await syncSubscriptionStatus(subscription.id, subscription.asaas_subscription_id);
                synced++;
            } catch (error) {
                console.error(`[SYNC] Falha ao sincronizar assinatura ${subscription.id}:`, error.message);
                failed++;
            }
        }

        console.log(`[SYNC] Sincronização concluída: ${synced} sucesso, ${failed} falhas`);

        return { success: true, synced, failed, total: result.rows.length };
    } catch (error) {
        console.error('[SYNC] Erro ao sincronizar assinaturas:', error);
        throw error;
    }
};
