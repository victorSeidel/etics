import createTransporter from '../utils/email.js';

export const sendPasswordResetEmail = async (email, name, newPassword) => 
{
    try 
    {
        const transporter = await createTransporter();

        const subject = 'Redefinição de Senha - ETICS';
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                        max-width: 600px; 
                        margin: 0 auto; 
                        padding: 20px;
                    }
                    .header { 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 30px; 
                        text-align: center; 
                        border-radius: 10px 10px 0 0;
                    }
                    .content { 
                        background: #f9f9f9; 
                        padding: 30px; 
                        border-radius: 0 0 10px 10px;
                        border: 1px solid #e0e0e0;
                    }
                    .password-box { 
                        background: #fff; 
                        padding: 15px; 
                        border: 2px dashed #667eea; 
                        border-radius: 5px; 
                        text-align: center; 
                        margin: 20px 0; 
                        font-size: 18px; 
                        font-weight: bold;
                    }
                    .warning { 
                        background: #fff3cd; 
                        border: 1px solid #ffeaa7; 
                        padding: 15px; 
                        border-radius: 5px; 
                        margin: 20px 0;
                        color: #856404;
                    }
                    .footer { 
                        text-align: center; 
                        margin-top: 30px; 
                        color: #666; 
                        font-size: 14px;
                    }
                    .button {
                        display: inline-block;
                        background: #667eea;
                        color: white;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 5px;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Redefinição de Senha</h1>
                </div>
                <div class="content">
                    <h2>Olá, ${name}!</h2>
                    
                    <p>Recebemos uma solicitação para redefinir sua senha. Sua senha temporária foi gerada com sucesso.</p>
                    
                    <div class="password-box">
                        🔒 Senha Temporária:<br>
                        <strong>${newPassword}</strong>
                    </div>
                    
                    <p>Utilize esta senha para fazer login no sistema. Recomendamos que você altere esta senha após o primeiro acesso.</p>
                    
                    <div style="text-align: center;">
                        <a href="${process.env.APP_URL}/login" class="button">
                            Fazer Login Agora
                        </a>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Importante:</strong>
                        <ul>
                            <li>Esta é uma senha temporária</li>
                            <li>Altere sua senha após o primeiro acesso</li>
                            <li>Não compartilhe sua senha com ninguém</li>
                            <li>Se você não solicitou esta redefinição, ignore este e-mail</li>
                        </ul>
                    </div>
                    
                    <p>Atenciosamente,<br>
                    <strong>Equipe ${process.env.EMAIL_FROM_NAME}</strong></p>
                </div>
                <div class="footer">
                    <p>Este é um e-mail automático, por favor não responda.</p>
                    <p>© ${new Date().getFullYear()} ${process.env.EMAIL_FROM_NAME}. Todos os direitos reservados.</p>
                </div>
            </body>
            </html>
        `;

        const text = `
            Redefinição de Senha - ${process.env.EMAIL_FROM_NAME}
            
            Olá, ${name}!
            
            Recebemos uma solicitação para redefinir sua senha. Sua nova senha temporária foi gerada com sucesso.
            
            Nova Senha Temporária: ${newPassword}
            
            Utilize esta senha para fazer login no sistema. Recomendamos que você altere esta senha após o primeiro acesso.
            
            Acesse: ${process.env.APP_URL}/login
            
            Importante:
            - Esta é uma senha temporária
            - Altere sua senha após o primeiro acesso
            - Não compartilhe sua senha com ninguém
            - Se você não solicitou esta redefinição, ignore este e-mail
            
            Atenciosamente,
            Equipe ${process.env.EMAIL_FROM_NAME}
            
            Este é um e-mail automático, por favor não responda.
        `;

        const mailOptions = { from: { name: process.env.EMAIL_FROM_NAME, address: process.env.EMAIL_USER }, to: email, subject: subject, text: text, html: html };

        const result = await transporter.sendMail(mailOptions);
        
        console.log(`[E-MAIL] Email de redefinição enviado para ${email}:`, result.messageId);
        return { success: true, messageId: result.messageId };
        
    } 
    catch (error) 
    {
        console.error('[E-MAIL] Erro ao enviar email de redefinição:', error);
        throw new Error('Falha ao enviar email de redefinição de senha');
    }
};

export const sendProcessCompletedEmail = async (email, name, processId, filename) => 
{
    try 
    {
        const transporter = await createTransporter();

        const subject = 'Processamento de PDF Concluído - ETICS';
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background: #f7f9fc;
                        padding: 20px;
                        color: #333;
                        line-height: 1.6;
                    }
                    .container {
                        background: white;
                        border-radius: 10px;
                        padding: 30px;
                        border: 1px solid #eee;
                        max-width: 600px;
                        margin: 0 auto;
                    }
                    h1 {
                        color: #4a56e2;
                    }
                    .button {
                        display: inline-block;
                        background: #4a56e2;
                        color: white;
                        padding: 12px 25px;
                        border-radius: 6px;
                        text-decoration: none;
                        margin-top: 20px;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        color: #666;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Seu PDF foi processado com sucesso!</h1>
                    <p>Olá, ${name}!</p>
                    <p>O arquivo <strong>${filename}</strong> foi totalmente processado e está disponível no sistema.</p>
                    <p>Você pode acessar o resultado completo clicando no botão abaixo:</p>
                    <div style="text-align:center;">
                        <a href="${process.env.APP_URL}/processos/${processId}" class="button">Ver Resultado</a>
                    </div>
                    <p>Atenciosamente,<br><strong>Equipe ${process.env.EMAIL_FROM_NAME}</strong></p>
                </div>
                <div class="footer">
                    <p>Este é um e-mail automático, por favor não responda.</p>
                    <p>© ${new Date().getFullYear()} ${process.env.EMAIL_FROM_NAME}</p>
                </div>
            </body>
            </html>
        `;

        const text = `
            Olá, ${name}!

            O arquivo ${filename} foi processado com sucesso e está disponível em:
            ${process.env.APP_URL}/processos/${processId}

            Atenciosamente,
            Equipe ${process.env.EMAIL_FROM_NAME}
        `;

        const mailOptions = { from: { name: process.env.EMAIL_FROM_NAME, address: process.env.EMAIL_USER }, to: email, subject, text, html };

        const result = await transporter.sendMail(mailOptions);
        console.log(`[E-MAIL] E-mail de conclusão enviado para ${email}: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
    } 
    catch (error) 
    {
        console.error('[E-MAIL] Erro ao enviar email de conclusão:', error);
    }
};