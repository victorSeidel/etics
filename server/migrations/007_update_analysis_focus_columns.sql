-- Migração para atualizar as colunas de análise focada
-- Renomeia focus_target e focus_type para focus_advogado e focus_reu
-- Isso permite selecionar advogado e réu simultaneamente

-- Renomear e modificar as colunas
ALTER TABLE process_analyses 
    RENAME COLUMN focus_target TO focus_advogado;

ALTER TABLE process_analyses 
    RENAME COLUMN focus_type TO focus_reu;

-- Remover a constraint antiga do focus_type (agora focus_reu)
ALTER TABLE process_analyses 
    DROP CONSTRAINT IF EXISTS process_analyses_focus_type_check;

-- Atualizar comentários das colunas
COMMENT ON COLUMN process_analyses.focus_advogado IS 'Nome do advogado para análise focada (opcional)';
COMMENT ON COLUMN process_analyses.focus_reu IS 'Nome do réu para análise focada (opcional)';
