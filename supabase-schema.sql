-- =========================================================================
-- SCHEMA DO PLANTEL DE FUTEBOL E CENÁRIOS TÁTICOS (SUPABASE / POSTGRESQL)
-- =========================================================================

-- Ativar extensão pgcrypto para geração de UUIDs, se ainda não estiver ativa
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. TABELA DE ATLETAS (PLAYERS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    number INTEGER NOT NULL CHECK (number >= 0 AND number <= 99),
    position_group VARCHAR(10) NOT NULL CHECK (position_group IN ('GK', 'DEF', 'MID', 'ATT')),
    position VARCHAR(10) DEFAULT 'MC', -- código da posição específica (ex: PL, DE, ED, MC...)
    preferred_foot VARCHAR(20) NOT NULL CHECK (preferred_foot IN ('Direito', 'Esquerdo', 'Ambos')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('Titular', 'Suplente', 'Reservado', 'Lesionado', 'Negociação')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5) DEFAULT 3,
    notes TEXT NOT NULL DEFAULT '',
    birth_date DATE, -- Armazena a data de nascimento (Ano-Mês-Dia)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS) para segurança no Supabase
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Exemplo de Políticas Simplificadas de RLS (Permitir acesso público geral para simplificação de desenvolvimento)
CREATE POLICY "Permitir leitura pública" ON public.players FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Permitir deleção pública" ON public.players FOR DELETE USING (true);


-- -------------------------------------------------------------------------
-- 2. TABELA DE CENÁRIOS E EQUIPAS TÁTICAS (SHADOW TEAMS)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shadow_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    system_id VARCHAR(50) NOT NULL, -- ex: '4-3-3', '4-4-2', etc.
    placements JSONB NOT NULL DEFAULT '{}'::jsonb, -- Dicionário ex: {"GK": "player-uuid", "CB1": "player-uuid"}
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS) para a tabela de cenários
ALTER TABLE public.shadow_teams ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para shadow_teams
CREATE POLICY "Permitir leitura pública" ON public.shadow_teams FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública" ON public.shadow_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir atualização pública" ON public.shadow_teams FOR UPDATE USING (true);
CREATE POLICY "Permitir deleção pública" ON public.shadow_teams FOR DELETE USING (true);


-- -------------------------------------------------------------------------
-- 3. FUNÇÃO E TRIGGER PARA ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMP (updated_at)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para tabela public.players
CREATE TRIGGER trigger_update_players_timestamp
    BEFORE UPDATE ON public.players
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_update_timestamp();

-- Trigger para tabela public.shadow_teams
CREATE TRIGGER trigger_update_shadow_teams_timestamp
    BEFORE UPDATE ON public.shadow_teams
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_update_timestamp();


-- -------------------------------------------------------------------------
-- 4. DADOS INICIAIS EXEMPLO (OPCIONAL - INSERIR SE DESEJAR TESTAR)
-- -------------------------------------------------------------------------
-- INSERT INTO public.players (name, status, rating, number, preferred_foot, position_group, position, birth_date, notes)
-- VALUES 
-- ('Diogo Costa', 'Titular', 5, 99, 'Direito', 'GK', 'GR', '1999-09-19', 'Excelente no um contra um e reposição rápida de bola.'),
-- ('Jaby', 'Titular', 5, 4, 'Ambos', 'DEF', 'DC', '2008-10-31', 'Excelente na antecipação e velocidade de recuperação.');
