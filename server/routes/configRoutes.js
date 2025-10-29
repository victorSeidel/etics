import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => 
{
    try 
    {
        const result = await pool.query("SELECT * FROM config");
        res.json(result.rows);
    } 
    catch (err) 
    {
        console.error(err);
        res.status(500).json({ error: "Erro ao buscar configurações" });
    }
});

router.get("/:name", async (req, res) => 
{
    try 
    {
        const { name } = req.params;
        const result = await pool.query("SELECT * FROM config WHERE name = $1", [name]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Configuração não encontrada" });
        res.json(result.rows[0]);
    } 
    catch (err) 
    {
        res.status(500).json({ error: "Erro interno" });
    }
});

router.put("/:name", async (req, res) =>
{
    const { name } = req.params;
    const { value } = req.body;

    try 
    {
        const result = await pool.query(`UPDATE config SET value=$1 WHERE name=$2 RETURNING *`, [value, name]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Configuração não encontrada" });
        res.json(result.rows[0]);
    } 
    catch (err) 
    {
        res.status(500).json({ error: "Erro ao atualizar configuração" });
    }
});

export default router;