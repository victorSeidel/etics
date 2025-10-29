import nodemailer from 'nodemailer';

const createTransporter = async () => 
{
    try 
    {
        console.log('Email user:', process.env.EMAIL_USER);
        console.log('App password exists:', process.env.EMAIL_APP_PASSWORD);

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