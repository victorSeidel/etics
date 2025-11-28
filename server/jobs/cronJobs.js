import cron from 'node-cron';

import { renewCredits, syncAllSubscriptionsStatus } from '../utils/credits.js'

// Renovação de créditos - executa a cada 6 horas
cron.schedule('0 */6 * * *', async () => 
{
    console.log('[JOBS] Executando verificação de renovação de créditos (mensais e anuais)...');
    try 
    {
        const result = await renewCredits();
        console.log(`[JOBS] Renovações processadas: ${result.renewed}`);
    }
    catch (error) 
    {
        console.error('[JOBS] Erro no agendamento de renovação:', error);
    }
});

// Sincronização de status com ASAAS - executa a cada 12 horas
cron.schedule('0 */12 * * *', async () => 
{
    console.log('[JOBS] Executando sincronização de status das assinaturas com ASAAS...');
    try 
    {
        const result = await syncAllSubscriptionsStatus();
        console.log(`[JOBS] Sincronização concluída: ${result.synced} atualizadas, ${result.failed} falhas`);
    }
    catch (error) 
    {
        console.error('[JOBS] Erro na sincronização de status:', error);
    }
});