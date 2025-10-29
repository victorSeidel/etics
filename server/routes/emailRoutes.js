import express from 'express';
import createTransporter from '../utils/email.js';

const router = express.Router();

router.post('/send', async (req, res) => 
{
    try 
    {
        const { to, subject, text, html } = req.body;

        if (!to || !subject || (!text && !html)) 
        {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios: to, subject e text ou html' });
        }

        const transporter = await createTransporter();

        const mailOptions = { from: { name: process.env.EMAIL_FROM_NAME, address: process.env.EMAIL_USER }, to, subject, text, html };

        const result = await transporter.sendMail(mailOptions);

        console.log('Email enviado com sucesso:', result.messageId);

        res.status(200).json({ success: true, message: 'Email enviado com sucesso', messageId: result.messageId });
    } 
    catch (error) 
    {
        console.error('Erro ao enviar email:', error);
        res.status(500).json({ success: false, message: 'Erro ao enviar email', error: error.message });
    }
});

export default router;