import { pool } from "../db.js";

export const checkCredits = async (userId, amount = 1) =>
{
    try
    {
        const result = await pool.query(
            `SELECT s.credits_available, s.status, p.display_name as plan_name
             FROM subscriptions s
             JOIN plans p ON s.plan_id = p.id
             WHERE s.user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0)
        {
            return {
                hasCredits: false,
                available: 0,
                message: "Assinatura não encontrada"
            };
        }

        const subscription = result.rows[0];

        if (subscription.status !== 'active')
        {
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
    catch (error)
    {
        console.error("Erro ao verificar créditos:", error);
        throw error;
    }
};

export const deductCredits = async (userId, amount, description, relatedEntity = null, relatedEntityId = null) =>
{
    try
    {
        // Verificar se tem créditos
        const check = await checkCredits(userId, amount);
        if (!check.hasCredits)
        {
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
    catch (error)
    {
        await pool.query('ROLLBACK');
        console.error("Erro ao deduzir créditos:", error);
        throw error;
    }
};

export const addCredits = async (userId, amount, description, type = 'credit') =>
{
    try
    {
        // Validar tipo
        const validTypes = ['credit', 'refund', 'bonus'];
        if (!validTypes.includes(type))
        {
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

        if (result.rows.length === 0)
        {
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
    catch (error)
    {
        await pool.query('ROLLBACK');
        console.error("Erro ao adicionar créditos:", error);
        throw error;
    }
};

export const refundCredits = async (userId, amount, description) =>
{
    return addCredits(userId, amount, description, 'refund');
};

export const requireCredits = (creditsRequired = 1) =>
{
    return async (req, res, next) =>
    {
        try
        {
            const check = await checkCredits(req.user.id, creditsRequired);

            if (!check.hasCredits)
            {
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
        catch (error)
        {
            console.error("Erro ao verificar créditos:", error);
            res.status(500).json({ error: "Erro ao verificar créditos" });
        }
    };
};

export const getCreditBalance = async (userId) =>
{
    try
    {
        const result = await pool.query(
            `SELECT credits_available, credits_used,
                    (credits_available + credits_used) as total_credits
             FROM subscriptions
             WHERE user_id = $1`,
            [userId]
        );

        if (result.rows.length === 0)
        {
            return { available: 0, used: 0, total: 0 };
        }

        const balance = result.rows[0];
        return {
            available: balance.credits_available,
            used: balance.credits_used,
            total: balance.total_credits
        };
    }
    catch (error)
    {
        console.error("Erro ao obter saldo de créditos:", error);
        throw error;
    }
};

export const renewMonthlyCredits = async () =>
{
    try
    {
        await pool.query('BEGIN');

        // Buscar assinaturas ativas que precisam de renovação
        const result = await pool.query(`SELECT s.id, s.user_id, s.plan_id, p.credits_per_month, p.display_name FROM subscriptions s JOIN plans p ON s.plan_id = p.id
            WHERE s.status = 'active' AND s.current_period_end <= CURRENT_TIMESTAMP`);

        for (const subscription of result.rows)
        {
            // Renovar créditos
            await pool.query(`UPDATE subscriptions SET credits_available = credits_available + $1 WHERE id = $2`, [subscription.credits_per_month, subscription.id]);

            // Registrar transação
            await pool.query(`INSERT INTO credit_transactions (user_id, subscription_id, amount, type, description) VALUES ($1, $2, $3, 'credit', $4)`,
                [subscription.user_id, subscription.id, subscription.credits_per_month, `Renovação mensal - ${subscription.display_name}`]);
        }

        await pool.query('COMMIT');

        return { success: true, renewed: result.rows.length };
    }
    catch (error)
    {
        await pool.query('ROLLBACK');
        console.error("Erro ao renovar créditos:", error);
        throw error;
    }
};
