import createTransporter from '../utils/email.js';

const getEmailTemplate = (title, content, actionUrl, actionText) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: #ffffff; 
            border-radius: 8px; 
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header { 
            background-color: #ffffff; 
            padding: 30px 20px; 
            text-align: center; 
            border-bottom: 3px solid #293366;
        }
        .content { 
            padding: 40px 30px; 
        }
        h1 {
            color: #293366;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
        }
        p {
            margin-bottom: 15px;
            color: #555;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .button {
            display: inline-block;
            background: linear-gradient(90deg, #293366 0%, #E23232 100%);
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            font-size: 16px;
        }
        .footer { 
            background-color: #f9f9f9;
            padding: 20px; 
            text-align: center; 
            color: #888; 
            font-size: 12px;
            border-top: 1px solid #eee;
        }
        .highlight-box {
            background: #f0f2f5;
            border-left: 4px solid #293366;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="${process.env.APP_URL}/logo.png" alt="ETICS Logo" height="50" style="display: block; margin: 0 auto;">
        </div>
        <div class="content">
            <h1>${title}</h1>
            ${content}
            ${actionUrl ? `
            <div class="button-container">
                <a href="${actionUrl}" class="button">${actionText}</a>
            </div>
            ` : ''}
            <p>Atenciosamente,<br><strong>Equipe ${process.env.EMAIL_FROM_NAME}</strong></p>
        </div>
        <div class="footer">
            <p>Este é um e-mail automático, por favor não responda.</p>
            <p>© ${new Date().getFullYear()} ${process.env.EMAIL_FROM_NAME}. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
`;

export const sendPasswordResetEmail = async (email, name, newPassword) => {
    try {
        const transporter = await createTransporter();
        const subject = 'Redefinição de Senha - ETICS';

        const content = `
            <p>Olá, ${name}!</p>
            <p>Recebemos uma solicitação para redefinir sua senha. Sua senha temporária foi gerada com sucesso.</p>
            
            <div class="highlight-box" style="text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px;">
                ${newPassword}
            </div>
            
            <p>Utilize esta senha para fazer login no sistema. <strong>Recomendamos fortemente que você altere esta senha após o primeiro acesso.</strong></p>
            
            <p style="font-size: 13px; color: #666;">Se você não solicitou esta redefinição, por favor ignore este e-mail ou entre em contato com o suporte.</p>
        `;

        const html = getEmailTemplate('Redefinição de Senha', content, `${process.env.APP_URL}/login`, 'Fazer Login Agora');

        const text = `Olá ${name}, sua nova senha temporária é: ${newPassword}. Acesse ${process.env.APP_URL}/login para entrar.`;

        const mailOptions = { from: { name: process.env.EMAIL_FROM_NAME, address: process.env.EMAIL_USER }, to: email, subject, text, html };

        const result = await transporter.sendMail(mailOptions);
        console.log(`[E-MAIL] Email de redefinição enviado para ${email}:`, result.messageId);
        return { success: true, messageId: result.messageId };
    }
    catch (error) {
        console.error('[E-MAIL] Erro ao enviar email de redefinição:', error);
        throw new Error('Falha ao enviar email de redefinição de senha');
    }
};

export const sendProcessCompletedEmail = async (email, name, processId) => {
    try {
        const transporter = await createTransporter();
        const subject = 'Processamento de PDF Concluído - ETICS';

        const content = `
            <p>Olá, ${name}!</p>
            <p>Temos boas notícias! Seu arquivo PDF foi totalmente processado e a análise já está disponível no sistema.</p>
            <p>Nossa IA identificou e extraiu as informações relevantes do seu documento com sucesso.</p>
        `;

        const html = getEmailTemplate('PDF Processado com Sucesso', content, `${process.env.APP_URL}/apps/analise-de-processos/processes/${processId}`, 'Ver Resultado da Análise');

        const text = `Olá ${name}, seu PDF foi processado com sucesso. Acesse: ${process.env.APP_URL}/apps/analise-de-processos/processes/${processId}`;

        const mailOptions = { from: { name: process.env.EMAIL_FROM_NAME, address: process.env.EMAIL_USER }, to: email, subject, text, html };

        const result = await transporter.sendMail(mailOptions);
        console.log(`[E-MAIL] E-mail de conclusão enviado para ${email}: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
    }
    catch (error) {
        console.error('[E-MAIL] Erro ao enviar email de conclusão:', error);
    }
};

export const sendAnalysisCompletedEmail = async (email, name) => {
    try {
        const transporter = await createTransporter();
        const subject = 'Análise de Processo Concluída - ETICS';

        const content = `
            <p>Olá, ${name}!</p>
            <p>Sua análise de processo foi finalizada com sucesso.</p>
            <p>Você já pode consultar todos os detalhes, insights e dados extraídos diretamente na plataforma.</p>
        `;

        const html = getEmailTemplate('Análise Finalizada', content, `${process.env.APP_URL}/apps/analise-de-processos/processes`, 'Acessar Meus Processos');

        const text = `Olá ${name}, sua análise foi concluída. Acesse: ${process.env.APP_URL}/apps/analise-de-processos/processes`;

        const mailOptions = { from: { name: process.env.EMAIL_FROM_NAME, address: process.env.EMAIL_USER }, to: email, subject, text, html };

        const result = await transporter.sendMail(mailOptions);
        console.log(`[E-MAIL] E-mail de conclusão enviado para ${email}: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
    }
    catch (error) {
        console.error('[E-MAIL] Erro ao enviar email de conclusão:', error);
    }
};