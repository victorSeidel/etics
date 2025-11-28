import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this-in-production";

export const authenticateToken = async (req, res, next) =>
{
    try
    {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token)
        {
            return res.status(401).json({ error: "Token não fornecido" });
        }

        jwt.verify(token, JWT_SECRET, async (err, decoded) =>
        {
            if (err)
            {
                return res.status(403).json({ error: "Token inválido ou expirado" });
            }

            // Buscar usuário completo do banco
            const userResult = await pool.query(
                `SELECT u.*,
                        s.id as subscription_id, s.credits_available, s.credits_used, s.status as subscription_status,
                        p.name as plan_name, p.display_name as plan_display_name
                    FROM users u
                    LEFT JOIN subscriptions s ON u.id = s.user_id LEFT JOIN plans p ON s.plan_id = p.id
                    WHERE u.id = $1`, [decoded.userId]
            );

            if (userResult.rows.length === 0)
            {
                return res.status(404).json({ error: "Usuário não encontrado" });
            }

            req.user = userResult.rows[0];
            next();
        });
    }
    catch (error)
    {
        console.error("Erro no middleware de autenticação:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};

export const requireAdmin = (req, res, next) =>
{
    if (req.user.role !== 'admin')
    {
        return res.status(403).json({ error: "Acesso negado: apenas administradores" });
    }
    next();
};

export const generateToken = (userId) =>
{
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1d' });
};
