-- Tabela de conversas de chat por processo
-- Limite de 10 conversas por processo é validado na aplicação
CREATE TABLE IF NOT EXISTS process_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Nova Conversa',
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de mensagens do chat
-- Limite de 30 mensagens de usuário por conversa é validado na aplicação
CREATE TABLE IF NOT EXISTS process_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES process_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_process_conversations_process_id ON process_conversations(process_id);
CREATE INDEX IF NOT EXISTS idx_process_conversations_user_id ON process_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_process_conversations_updated_at ON process_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON process_chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON process_chat_messages(created_at);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE process_conversations
    SET updated_at = CURRENT_TIMESTAMP,
        message_count = (SELECT COUNT(*) FROM process_chat_messages WHERE conversation_id = NEW.conversation_id)
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message
AFTER INSERT ON process_chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_updated_at();

-- Trigger para atualizar updated_at da conversa
CREATE TRIGGER update_process_conversations_updated_at
BEFORE UPDATE ON process_conversations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
