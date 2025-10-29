import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { getCreditBalance, checkCredits } from "../utils/credits.js";

const router = Router();

// Listar todos os usuários
router.get("/", authenticateToken, requireAdmin, async (req, res) =>
{
    try
    {
        const result = await pool.query(
            `SELECT u.id, u.email, u.name, u.role, u.created_at,
                    s.credits_available, s.credits_used, s.status as subscription_status,
                    p.name as plan_name, p.display_name as plan_display_name
             FROM users u
             LEFT JOIN subscriptions s ON u.id = s.user_id
             LEFT JOIN plans p ON s.plan_id = p.id
             ORDER BY u.created_at DESC`
        );

        const users = result.rows.map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plan: user.plan_name || 'free',
            planDisplayName: user.plan_display_name || 'Gratuito',
            credits: user.credits_available || 0,
            creditsUsed: user.credits_used || 0,
            subscriptionStatus: user.subscription_status || 'active',
            createdAt: user.created_at
        }));

        res.json(users);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

// Buscar usuário por ID (admin ou próprio usuário)
router.get("/:id", authenticateToken, async (req, res) =>
{
    try
    {
        const { id } = req.params;

        // Verificar se é admin ou o próprio usuário
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id))
        {
            return res.status(403).json({ error: "Acesso negado" });
        }

        const result = await pool.query(
            `SELECT u.id, u.email, u.name, u.role, u.created_at,
                    s.id as subscription_id, s.credits_available, s.credits_used,
                    s.status as subscription_status, s.billing_cycle,
                    p.name as plan_name, p.display_name as plan_display_name
             FROM users u
             LEFT JOIN subscriptions s ON u.id = s.user_id
             LEFT JOIN plans p ON s.plan_id = p.id
             WHERE u.id = $1`,
            [id]
        );

        if (result.rows.length === 0)
        {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const user = result.rows[0];
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plan: user.plan_name || 'free',
            planDisplayName: user.plan_display_name || 'Gratuito',
            credits: user.credits_available || 0,
            creditsUsed: user.credits_used || 0,
            subscriptionStatus: user.subscription_status || 'active',
            billingCycle: user.billing_cycle,
            createdAt: user.created_at
        });
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ error: "Erro interno" });
    }
});

// Atualizar perfil do usuário (admin ou próprio usuário)
router.put("/:id", authenticateToken, async (req, res) =>
{
    const { id } = req.params;
    const { name, email, role } = req.body;

    try
    {
        // Verificar se é admin ou o próprio usuário
        const isAdmin = req.user.role === 'admin';
        const isOwnProfile = req.user.id === parseInt(id);

        if (!isAdmin && !isOwnProfile)
        {
            return res.status(403).json({ error: "Acesso negado" });
        }

        // Usuários normais não podem alterar role
        if (!isAdmin && role)
        {
            return res.status(403).json({ error: "Apenas administradores podem alterar roles" });
        }

        // Construir query dinamicamente
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name)
        {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }

        if (email)
        {
            updates.push(`email = $${paramCount++}`);
            values.push(email);
        }

        if (role && isAdmin)
        {
            updates.push(`role = $${paramCount++}`);
            values.push(role);
        }

        if (updates.length === 0)
        {
            return res.status(400).json({ error: "Nenhum campo para atualizar" });
        }

        values.push(id);

        const result = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, name, role`,
            values
        );

        if (result.rows.length === 0)
        {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        res.json(result.rows[0]);
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
});

// Deletar usuário (apenas admin)
router.delete("/:id", authenticateToken, async (req, res) =>
{
    try
    {
        const { id } = req.params;

        // Verificar se é admin ou o próprio usuário
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id))
        {
            return res.status(403).json({ error: "Acesso negado" });
        }

        const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [id]);

        if (result.rows.length === 0)
        {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        res.json({ message: "Usuário removido com sucesso" });
    }
    catch (err)
    {
        console.error(err);
        res.status(500).json({ error: "Erro ao remover usuário" });
    }
});

// Obter saldo de créditos do usuário
router.get("/:id/credits", authenticateToken, async (req, res) =>
{
    try
    {
        const { id } = req.params;

        // Verificar se é admin ou o próprio usuário
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id))
        {
            return res.status(403).json({ error: "Acesso negado" });
        }

        const balance = await getCreditBalance(parseInt(id));
        res.json(balance);
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({ error: "Erro ao buscar saldo de créditos" });
    }
});

// Verificar se usuário tem créditos suficientes
router.post("/:id/check-credits", authenticateToken, async (req, res) =>
{
    try
    {
        const { id } = req.params;
        const { amount = 1 } = req.body;

        // Verificar se é admin ou o próprio usuário
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id))
        {
            return res.status(403).json({ error: "Acesso negado" });
        }

        const check = await checkCredits(parseInt(id), amount);
        res.json(check);
    }
    catch (error)
    {
        console.error(error);
        res.status(500).json({ error: "Erro ao verificar créditos" });
    }
});

router.post("/:id/change-password", authenticateToken, async (req, res) =>
{
    const { currentPassword, newPassword } = req.body;

    try
    {
        const { id } = req.params;

        // Verificar se é admin ou o próprio usuário
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id))
        {
            return res.status(403).json({ error: "Acesso negado" });
        }

        if (!currentPassword || !newPassword)
        {
            return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
        }

        if (newPassword.length < 6)
        {
            return res.status(400).json({ error: "A nova senha deve ter no mínimo 6 caracteres" });
        }

        // Buscar senha atual do usuário
        const result = await pool.query( "SELECT password_hash FROM users WHERE id = $1", [req.user.id]);

        const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!validPassword)
        {
            return res.status(401).json({ error: "Senha atual incorreta" });
        }

        // Hash da nova senha
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        // Atualizar senha
        await pool.query( "UPDATE users SET password_hash = $1 WHERE id = $2", [password_hash, req.user.id]);

        res.json({ message: "Senha alterada com sucesso" });
    }
    catch (error)
    {
        console.error("Erro ao alterar senha:", error);
        res.status(500).json({ error: "Erro ao alterar senha" });
    }
});

export default router;