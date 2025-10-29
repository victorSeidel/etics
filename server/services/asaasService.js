import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE_URL = 'https://sandbox.asaas.com/api/v3'; // Mude para https://api.asaas.com/v3 em produção

const asaasApi = axios.create({
    baseURL: ASAAS_BASE_URL,
    headers: {
        'access_token': '$' + ASAAS_API_KEY,
        'Content-Type': 'application/json'
    }
});

export async function createAsaasCustomer(customerData) 
{
    try 
    {
        const response = await asaasApi.post('/customers', {
            name: customerData.name,
            email: customerData.email,
            cpfCnpj: customerData.cpf.replace(/\D/g, ''),
            phone: customerData.phone?.replace(/\D/g, ''),
            mobilePhone: customerData.phone?.replace(/\D/g, ''),
            postalCode: customerData.postalCode?.replace(/\D/g, ''),
            addressNumber: customerData.addressNumber,
            notificationDisabled: false
        });

        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao criar cliente no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao criar cliente: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}

export async function updateAsaasCustomer(customerId, customerData) 
{
    try 
    {
        const response = await asaasApi.put(`/customers/${customerId}`, {
            name: customerData.name,
            email: customerData.email,
            cpfCnpj: customerData.cpf?.replace(/\D/g, ''),
            phone: customerData.phone?.replace(/\D/g, ''),
            mobilePhone: customerData.phone?.replace(/\D/g, ''),
            postalCode: customerData.postalCode?.replace(/\D/g, ''),
            addressNumber: customerData.addressNumber
        });

        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao atualizar cliente no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao atualizar cliente: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}

export async function createAsaasSubscription(subscriptionData) 
{
    try 
    {
        const cycle = subscriptionData.billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY';

        const payload = {
            customer: subscriptionData.customerId,
            billingType: subscriptionData.billingType || 'CREDIT_CARD',
            cycle: cycle,
            value: subscriptionData.value,
            nextDueDate: subscriptionData.nextDueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 dias a partir de hoje
            description: subscriptionData.description || 'Assinatura ETICS',
            externalReference: subscriptionData.externalReference,
        };

        if (subscriptionData.billingType === 'CREDIT_CARD' && subscriptionData.creditCard) 
        {
            payload.creditCard = {
                holderName: subscriptionData.creditCard.holderName,
                number: subscriptionData.creditCard.number.replace(/\s/g, ''),
                expiryMonth: subscriptionData.creditCard.expiryMonth,
                expiryYear: subscriptionData.creditCard.expiryYear,
                ccv: subscriptionData.creditCard.ccv
            };

            payload.creditCardHolderInfo = {
                name: subscriptionData.creditCard.holderName,
                email: subscriptionData.creditCardHolderInfo?.email,
                cpfCnpj: subscriptionData.creditCardHolderInfo?.cpfCnpj?.replace(/\D/g, ''),
                postalCode: subscriptionData.creditCardHolderInfo?.postalCode?.replace(/\D/g, ''),
                addressNumber: subscriptionData.creditCardHolderInfo?.addressNumber,
                phone: subscriptionData.creditCardHolderInfo?.phone?.replace(/\D/g, '')
            };
        }

        const response = await asaasApi.post('/subscriptions', payload);

        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao criar assinatura no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao criar assinatura: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}

export async function cancelAsaasSubscription(subscriptionId) 
{
    try 
    {
        const response = await asaasApi.delete(`/subscriptions/${subscriptionId}`);
        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao cancelar assinatura no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao cancelar assinatura: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}

export async function getAsaasSubscription(subscriptionId) 
{
    try 
    {
        const response = await asaasApi.get(`/subscriptions/${subscriptionId}`);
        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao buscar assinatura no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao buscar assinatura: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}

export async function getAsaasCustomer(customerId) 
{
    try 
    {
        const response = await asaasApi.get(`/customers/${customerId}`);
        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao buscar cliente no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao buscar cliente: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}

export async function updateAsaasSubscription(subscriptionId, updateData) 
{
    try 
    {
        const payload = {};

        if (updateData.value) payload.value = updateData.value;
        if (updateData.nextDueDate) payload.nextDueDate = updateData.nextDueDate;
        if (updateData.cycle) payload.cycle = updateData.cycle;
        if (updateData.description) payload.description = updateData.description;

        const response = await asaasApi.put(`/subscriptions/${subscriptionId}`, payload);
        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao atualizar assinatura no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao atualizar assinatura: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}

export async function getSubscriptionPayments(subscriptionId) 
{
    try 
    {
        const response = await asaasApi.get(`/payments?subscription=${subscriptionId}`);
        return response.data;
    } 
    catch (error) 
    {
        console.error('Erro ao buscar pagamentos no ASAAS:', error.response?.data || error.message);
        throw new Error(`Erro ao buscar pagamentos: ${error.response?.data?.errors?.[0]?.description || error.message}`);
    }
}
