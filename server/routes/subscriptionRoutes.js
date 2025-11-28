import { Router } from "express";
import { pool } from "../db.js";

import { authenticateToken, requireAdmin } from "../middleware/auth.js";

import { createAsaasCustomer, createAsaasSubscription, cancelAsaasSubscription, getSubscriptionPayments } from '../services/asaasService.js';

const router = Router();

// Obter todos os planos disponíveis
router.get("/plans", async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, name, display_name, description, credits_per_month, 
            billing_cycle, price_monthly, price_yearly, features FROM plans WHERE is_active = true ORDER BY price_monthly ASC`);

        res.json(result.rows);
    }
    catch (error) {
        console.error("Erro ao buscar planos:", error);
        res.status(500).json({ error: "Erro ao buscar planos" });
    }
});

router.get("/all", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`SELECT s.*, p.name as plan_name, p.display_name as plan_display_name, p.description as plan_description, p.credits_per_month, 
            p.price_monthly, p.billing_cycle, p.price_yearly,p.features FROM subscriptions s JOIN plans p ON s.plan_id = p.id`);

        if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura não encontrada" });

        res.json(result.rows[0]);
    }
    catch (error) {
        console.error("Erro ao buscar assinatura:", error);
        res.status(500).json({ error: "Erro ao buscar assinatura" });
    }
});

// Obter assinatura do usuário autenticado
router.get("/my-subscription", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`SELECT s.*, p.name as plan_name, p.display_name as plan_display_name, p.description as plan_description, p.credits_per_month, 
            p.price_monthly, p.billing_cycle, p.price_yearly, p.features FROM subscriptions s JOIN plans p ON s.plan_id = p.id WHERE s.user_id = $1 AND s.status = 'active'`, [req.user.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura não encontrada" });

        res.json(result.rows[0]);
    }
    catch (error) {
        console.error("Erro ao buscar assinatura:", error);
        res.status(500).json({ error: "Erro ao buscar assinatura" });
    }
});

// Trocar plano
router.post("/change-plan", authenticateToken, async (req, res) => {
    const { planId, billingCycle } = req.body;

    try {
        if (!planId) return res.status(400).json({ error: "ID do plano é obrigatório" });

        const cycle = billingCycle || 'mensal';
        if (!['mensal', 'anual'].includes(cycle)) return res.status(400).json({ error: "Ciclo de cobrança inválido" });

        const planResult = await pool.query("SELECT * FROM plans WHERE id = $1 AND is_active = true", [planId]);
        if (planResult.rows.length === 0) return res.status(404).json({ error: "Plano não encontrado" });

        const newPlan = planResult.rows[0];

        await pool.query('BEGIN');

        const currentSubResult = await pool.query("SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'", [req.user.id]);
        if (currentSubResult.rows.length > 0) {
            await pool.query(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`, [req.user.id]);
        }

        const period = cycle === 'anual' ? '1 year' : '30 days';
        const subResult = await pool.query(`INSERT INTO subscriptions (user_id, plan_id, credits_available, billing_cycle, current_period_end, status)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '${period}', 'active') 
                RETURNING *`, [req.user.id, planId, newPlan.credits_per_month, cycle]);

        const subscription = subResult.rows[0];

        await pool.query(`INSERT INTO credit_transactions (user_id, subscription_id, amount, type, description)
            VALUES ($1, $2, $3, 'credit', $4)`, [req.user.id, subscription.id, newPlan.credits_per_month,
        currentSubResult.rows.length > 0 ? `Upgrade para plano ${newPlan.display_name}` : `Créditos do plano ${newPlan.display_name}`]);

        await pool.query('COMMIT');

        res.json({ message: "Plano alterado com sucesso", subscription: { ...subscription, plan_name: newPlan.name, plan_display_name: newPlan.display_name } });
    }
    catch (error) {
        await pool.query('ROLLBACK');
        console.error("Erro ao trocar plano:", error);
        res.status(500).json({ error: "Erro ao trocar plano" });
    }
});

// Cancelar assinatura
router.post("/cancel", authenticateToken, async (req, res) => {
    try {
        const currentSubResult = await client.query("SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'", [req.user.id]);

        if (currentSubResult.rows.length > 0) {
            const currentSub = currentSubResult.rows[0];

            if (currentSub.asaas_subscription_id) {
                try {
                    await cancelAsaasSubscription(currentSub.asaas_subscription_id);
                }
                catch (error) {
                    console.error('Erro ao cancelar assinatura antiga no ASAAS:', error.message);
                }
            }
        }

        const result = await pool.query(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP 
            WHERE user_id = $1 AND status = 'active' RETURNING *`, [req.user.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura ativa não encontrada" });

        res.json({ message: "Assinatura cancelada com sucesso", subscription: result.rows[0] });
    }
    catch (error) {
        console.error("Erro ao cancelar assinatura:", error);
        res.status(500).json({ error: "Erro ao cancelar assinatura" });
    }
});

// Reativar assinatura
router.post("/reactivate", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`UPDATE subscriptions SET status = 'active', cancelled_at = NULL, current_period_end = CURRENT_TIMESTAMP + INTERVAL '1 year'
            WHERE user_id = $1 AND status = 'cancelled' RETURNING *`, [req.user.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: "Assinatura cancelada não encontrada" });

        res.json({ message: "Assinatura reativada com sucesso", subscription: result.rows[0] });
    }
    catch (error) {
        console.error("Erro ao reativar assinatura:", error);
        res.status(500).json({ error: "Erro ao reativar assinatura" });
    }
});

// Histórico de transações de créditos
router.get("/credit-history", authenticateToken, async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;

        const result = await pool.query(`SELECT ct.*, s.plan_id, p.display_name as plan_name FROM credit_transactions ct 
            JOIN subscriptions s ON ct.subscription_id = s.id JOIN plans p ON s.plan_id = p.id
                WHERE ct.user_id = $1 ORDER BY ct.created_at DESC LIMIT $2 OFFSET $3`, [req.user.id, limit, offset]);

        const countResult = await pool.query("SELECT COUNT(*) FROM credit_transactions WHERE user_id = $1", [req.user.id]);

        res.json({ transactions: result.rows, total: parseInt(countResult.rows[0].count), limit: parseInt(limit), offset: parseInt(offset) });
    }
    catch (error) {
        console.error("Erro ao buscar histórico:", error);
        res.status(500).json({ error: "Erro ao buscar histórico de créditos" });
    }
});

// Criar nova assinatura (integração com ASAAS)
router.post("/subscribe", authenticateToken, async (req, res) => 
{
    const client = await pool.connect();

    try 
    {
        const { planId, paymentMethod, paymentData } = req.body;

        if (!planId || !paymentData || !paymentMethod) return res.status(400).json({ error: "Dados incompletos" });

        const validPaymentMethods = ['CREDIT_CARD', 'PIX', 'BOLETO'];
        if (!validPaymentMethods.includes(paymentMethod)) return res.status(400).json({ error: "Método de pagamento inválido" });

        const { nomeTitular, cpf, email, telefone, cep, numeroCasa, numeroCartao, validade, cvv } = paymentData;

        if (!nomeTitular || !cpf || !email || !telefone || !cep || !numeroCasa) return res.status(400).json({ error: "Dados pessoais e de endereço são obrigatórios" });

        if (paymentMethod === 'CREDIT_CARD') 
        {
            if (!numeroCartao || !validade || !cvv) return res.status(400).json({ error: "Dados do cartão são obrigatórios para pagamento com cartão" });
        }

        await client.query('BEGIN');

        const userResult = await client.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        const user = userResult.rows[0];

        let asaasCustomerId = user.asaas_id;

        if (!asaasCustomerId) 
        {
            const customerData = await createAsaasCustomer({ name: nomeTitular, email: email, cpf: cpf, phone: telefone, postalCode: cep, addressNumber: numeroCasa });

            asaasCustomerId = customerData.id;
            await client.query(`UPDATE users SET asaas_id = $1 WHERE id = $2`, [asaasCustomerId, req.user.id]);
        }

        const currentSubResult = await client.query("SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active'", [req.user.id]);
        if (currentSubResult.rows.length > 0) 
        {
            const currentSub = currentSubResult.rows[0];

            if (currentSub.asaas_subscription_id) 
            {
                try { await cancelAsaasSubscription(currentSub.asaas_subscription_id); }
                catch (error) { console.error('Erro ao cancelar assinatura antiga no ASAAS:', error.message); }
            }
        }

        const planResult = await client.query("SELECT * FROM plans WHERE id = $1 AND is_active = true", [planId]);
        if (planResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: "Plano não encontrado" }); }

        let asaasResponse;
        let responseData = {  message: "Assinatura criada com sucesso", paymentMethod: paymentMethod };

        const plan = planResult.rows[0];
        const planValue = plan.billing_cycle === 'anual' ? plan.price_yearly : plan.price_monthly;
        const cycle = plan.billing_cycle === 'anual' ? 'yearly' : 'monthly';

        if (paymentMethod === 'CREDIT_CARD') 
        {
            const [expiryMonth, expiryYear] = validade.split('/');

            asaasResponse = await createAsaasSubscription({
                customerId: asaasCustomerId,
                billingType: paymentMethod,
                billingCycle: cycle,
                value: planValue,
                description: `Plano ${plan.display_name} - ETICS`,
                externalReference: `user_${req.user.id}_plan_${planId}`,
                creditCard: {
                    holderName: nomeTitular,
                    number: numeroCartao,
                    expiryMonth: expiryMonth,
                    expiryYear: `20${expiryYear}`,
                    ccv: cvv
                },
                creditCardHolderInfo: {
                    name: nomeTitular,
                    email: email,
                    cpfCnpj: cpf,
                    postalCode: cep,
                    addressNumber: numeroCasa,
                    phone: telefone
                }
            });
        }
        else if (paymentMethod === 'PIX' || paymentMethod === 'BOLETO') 
        {
            asaasResponse = await createAsaasSubscription({
                customerId: asaasCustomerId, 
                billingType: paymentMethod, 
                billingCycle: cycle, 
                value: planValue,
                description: `Plano ${plan.display_name} - ETICS`, 
                externalReference: `user_${req.user.id}_plan_${planId}`
            });

            if (asaasResponse.id) 
            {
                const paymentDetails = await getSubscriptionPayments(asaasResponse.id);
                const paymentData = paymentDetails.data;
                

                if (paymentMethod === 'PIX') responseData.link = paymentData[0].invoiceUrl

                if (paymentMethod === 'BOLETO') responseData.link = paymentData[0].bankSlipUrl || paymentData[0].invoiceUrl;
            }
        }

        const periodEnd = cycle === 'anual' ? '1 year' : '30 days';

        let subscriptionResult = await client.query(`UPDATE subscriptions SET plan_id = $2, credits_available = credits_available + $3, billing_cycle = $4, 
            current_period_end = CURRENT_TIMESTAMP + INTERVAL '${periodEnd}', status = 'active', asaas_subscription_id = $5, payment_method = $6,
                next_due_date = $7, cancelled_at = NULL WHERE user_id = $1 RETURNING *`,
                    [req.user.id, planId, plan.credits_per_month, cycle, asaasResponse.id, paymentMethod, asaasResponse.nextDueDate]);

        let subscription;
        if (subscriptionResult.rows.length === 0) 
        {
            const credits = cycle === 'anual' ? plan.credits_per_month * 12 : plan.credits_per_month;

            subscriptionResult = await client.query(`INSERT INTO subscriptions (user_id, plan_id, credits_available, billing_cycle, current_period_end, status, 
                asaas_subscription_id, payment_method, next_due_date) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '${periodEnd}', 'active', $5, $6, $7) RETURNING *`,
                    [req.user.id, planId, credits, cycle, asaasResponse.id, paymentMethod, asaasResponse.nextDueDate]);
        }

        subscription = subscriptionResult.rows[0];

        await client.query(`INSERT INTO credit_transactions (user_id, subscription_id, amount, type, description)
            VALUES ($1, $2, $3, 'credit', $4)`,
                [req.user.id, subscription.id, plan.credits_per_month, `Créditos do plano ${plan.display_name}`]);

        await client.query('COMMIT');

        responseData.subscription = { ...subscription, plan_name: plan.name, plan_display_name: plan.display_name, asaas_subscription_id: asaasResponse.id };

        res.json(responseData);
    }
    catch (error) 
    {
        await client.query('ROLLBACK');
        console.error("Erro ao criar assinatura:", error);
        res.status(500).json({ error: "Erro ao criar assinatura", details: error.message });
    }
    finally 
    {
        client.release();
    }
});

export default router;