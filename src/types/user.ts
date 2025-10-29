export interface User
{
    id: number;
    email: string;
    name: string;
    role: 'user' | 'admin';
    plan: string;
    planDisplayName?: string;
    credits: number;
    subscriptionStatus?: 'active' | 'cancelled' | 'expired' | 'suspended';
    created_at?: string;
}

export interface Plan
{
    id: number;
    name: string;
    display_name: string;
    description: string;
    credits_per_month: number;
    price_monthly: number;
    price_yearly?: number;
    features?: Record<string, any>;
}

export interface Subscription
{
    id: number;
    user_id: number;
    plan_id: number;
    credits_available: number;
    credits_used: number;
    status: 'active' | 'cancelled' | 'expired' | 'suspended';
    billing_cycle: 'monthly' | 'yearly';
    current_period_start: string;
    current_period_end: string;
    cancelled_at?: string;
    plan_name?: string;
    plan_display_name?: string;
}

export interface CreditTransaction
{
    id: number;
    user_id: number;
    subscription_id: number;
    amount: number;
    type: 'credit' | 'debit' | 'refund' | 'bonus';
    description: string;
    related_entity?: string;
    related_entity_id?: number;
    created_at: string;
}