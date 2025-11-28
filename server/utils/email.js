import nodemailer from 'nodemailer';

const createTransporter = async () => 
{
    try 
    {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });

        return transporter;
    } 
    catch (error) 
    {
        console.error('[E-MAIL] Erro ao criar envio de e-mails:', error);
        throw error;
    }
};

export default createTransporter;