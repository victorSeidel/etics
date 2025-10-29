import cron from 'node-cron';

import {renewMonthlyCredits } from './utils/credits.js'

cron.schedule('0 */6 * * *', async () => 
{
    console.log('[JOBS] Executando verificação de renovação de créditos...');
    try 
    {
        const result = await renewMonthlyCredits();
        console.log(`[JOBS] Renovações processadas: ${result.renewed}`);
    } 
    catch (error) 
    {
        console.error('[JOBS] Erro no agendamento de renovação:', error);
    }
});