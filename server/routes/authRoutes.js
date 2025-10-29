import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";
import { sendPasswordResetEmail } from '../services/emailService.js';

const router = Router();

// Registro de novo usuário
router.post("/register", async (req, res) =>
{
    const { email, name, password } = req.body;

    try
    {
        // Validações básicas
        if (!email || !name || !password)
        {
            return res.status(400).json({ error: "Todos os campos são obrigatórios" });
        }

        if (password.length < 6)
        {
            return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
        }

        // Verificar se usuário já existe
        const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

        if (existingUser.rows.length > 0)
        {
            return res.status(409).json({ error: "Este e-mail já está cadastrado" });
        }

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Iniciar transação
        await pool.query('BEGIN');

        // Criar usuário
        const userResult = await pool.query(
            `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at`, [email, name, password_hash, 'user']);

        const user = userResult.rows[0];

        const planResult = await pool.query("SELECT id, credits_per_month FROM plans WHERE name = 'free'");

        if (planResult.rows.length === 0)
        {
            await pool.query('ROLLBACK');
            return res.status(500).json({ error: "Plano gratuito não encontrado" });
        }

        const freePlan = planResult.rows[0];

        // Criar assinatura gratuita
        const subscriptionResult = await pool.query(
            `INSERT INTO subscriptions (user_id, plan_id, credits_available, status, current_period_end) VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP + INTERVAL '100 years')
                RETURNING id, credits_available`, [user.id, freePlan.id, freePlan.credits_per_month]);

        const subscription = subscriptionResult.rows[0];

        await pool.query(
            `INSERT INTO credit_transactions (user_id, subscription_id, amount, type, description) VALUES ($1, $2, $3, 'credit', 'Créditos iniciais do plano gratuito')`,
                [user.id, subscription.id, freePlan.credits_per_month]);

        await pool.query('COMMIT');

        // Gerar token
        const token = generateToken(user.id);

        res.status(201).json({
            message: "Usuário criado com sucesso",
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: 'free', credits: subscription.credits_available }
        });
    }
    catch (error)
    {
        await pool.query('ROLLBACK');
        console.error("Erro ao registrar usuário:", error);
        res.status(500).json({ error: "Erro ao criar usuário" });
    }
});

// Login
router.post("/login", async (req, res) =>
{
    const { email, password } = req.body;

    try
    {
        if (!email || !password)
        {
            return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
        }

        // Buscar usuário com dados da assinatura
        const result = await pool.query(
            `SELECT u.id, u.email, u.name, u.role, u.password_hash,
                    s.credits_available, s.credits_used, s.status as subscription_status,
                    p.name as plan_name, p.display_name as plan_display_name
             FROM users u
             LEFT JOIN subscriptions s ON u.id = s.user_id
             LEFT JOIN plans p ON s.plan_id = p.id
             WHERE u.email = $1`,
            [email]
        );

        if (result.rows.length === 0)
        {
            return res.status(401).json({ error: "E-mail ou senha incorretos" });
        }

        const user = result.rows[0];

        // Verificar senha
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword)
        {
            return res.status(401).json({ error: "E-mail ou senha incorretos" });
        }

        // Gerar token
        const token = generateToken(user.id);

        res.json({
            message: "Login realizado com sucesso",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                plan: user.plan_name || 'free',
                planDisplayName: user.plan_display_name || 'Gratuito',
                credits: user.credits_available || 0,
                subscriptionStatus: user.subscription_status || 'active'
            }
        });
    }
    catch (error)
    {
        console.error("Erro ao fazer login:", error);
        res.status(500).json({ error: "Erro ao fazer login" });
    }
});

// Verificar token e retornar dados do usuário
router.get("/me", authenticateToken, async (req, res) =>
{
    try
    {
        const user = req.user;

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                plan: user.plan_name || 'free',
                planDisplayName: user.plan_display_name || 'Gratuito',
                credits: user.credits_available || 0,
                subscriptionStatus: user.subscription_status || 'active'
            }
        });
    }
    catch (error)
    {
        console.error("Erro ao buscar usuário:", error);
        res.status(500).json({ error: "Erro ao buscar dados do usuário" });
    }
});

// Logout
router.post("/logout", authenticateToken, (req, res) =>
{
    res.json({ message: "Logout realizado com sucesso" });
});

function generateTemporaryPassword() 
{
    const length = 12;
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%&*";
    
    let password = "";
    
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    const allChars = lowercase + uppercase + numbers + special;
    for (let i = password.length; i < length; i++) { password += allChars[Math.floor(Math.random() * allChars.length)]; }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

router.post("/reset-password", async (req, res) => 
{
    const { email } = req.body;

    try 
    {
        if (!email) 
        {
            return res.status(400).json({ success: false, error: "Email é obrigatório" });
        }

        const userResult = await pool.query("SELECT id, email, name FROM users WHERE email = $1", [email]);

        if (userResult.rows.length === 0) 
        {
            return res.json({ success: true, message: "Se o email existir em nosso sistema, enviaremos uma nova senha" });
        }

        const user = userResult.rows[0];

        const newPassword = generateTemporaryPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hashedPassword, user.id]);

        await sendPasswordResetEmail(user.email, user.name, newPassword);

        res.json({ success: true, message: "Se o email existir em nosso sistema, enviaremos uma nova senha" });
    } 
    catch (error) 
    {
        console.error("Erro no reset simples de senha:", error);
        res.status(500).json({ success: false, error: "Erro interno do servidor" });
    }
});

export default router;