-- Adicionar campos para integração com ASAAS
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS asaas_payment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS next_due_date DATE;

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_asaas_id ON subscriptions(asaas_subscription_id);
