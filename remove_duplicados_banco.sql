-- ==========================================
-- 1. LIMPEZA DE CATEGORIAS DUPLICADAS
-- ==========================================

-- Atualiza lançamentos
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM categorias
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM categorias c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
UPDATE lancamentos SET categoria_id = mapping.new_id FROM mapping WHERE categoria_id = mapping.old_id;

-- Atualiza recorrentes
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM categorias
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM categorias c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
UPDATE recorrentes SET categoria_id = mapping.new_id FROM mapping WHERE categoria_id = mapping.old_id;

-- Atualiza subcategorias
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM categorias
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM categorias c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
UPDATE subcategorias SET categoria_id = mapping.new_id FROM mapping WHERE categoria_id = mapping.old_id;

-- Deleta as categorias duplicadas
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM categorias
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM categorias c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
DELETE FROM categorias c USING mapping WHERE c.id = mapping.old_id;


-- ==========================================
-- 2. LIMPEZA DE CARTEIRAS DUPLICADAS
-- ==========================================

-- Atualiza lançamentos
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM carteiras
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM carteiras c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
UPDATE lancamentos SET carteira_id = mapping.new_id FROM mapping WHERE carteira_id = mapping.old_id;

-- Atualiza recorrentes
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM carteiras
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM carteiras c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
UPDATE recorrentes SET carteira_id = mapping.new_id FROM mapping WHERE carteira_id = mapping.old_id;

-- Deleta as carteiras duplicadas
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM carteiras
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM carteiras c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
DELETE FROM carteiras c USING mapping WHERE c.id = mapping.old_id;


-- ==========================================
-- 3. LIMPEZA DE FONTES DE RENDA DUPLICADAS
-- ==========================================

-- Atualiza lançamentos
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM fontes_renda
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM fontes_renda c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
UPDATE lancamentos SET fonte_renda_id = mapping.new_id FROM mapping WHERE fonte_renda_id = mapping.old_id;

-- Deleta as fontes duplicadas
WITH duplicate_groups AS (
    SELECT user_id, LOWER(TRIM(nome)) as norm_nome, (array_agg(id ORDER BY created_at ASC))[1] as keep_id
    FROM fontes_renda
    GROUP BY user_id, LOWER(TRIM(nome))
    HAVING COUNT(*) > 1
),
mapping AS (
    SELECT c.id as old_id, dg.keep_id as new_id
    FROM fontes_renda c
    JOIN duplicate_groups dg ON c.user_id = dg.user_id AND LOWER(TRIM(c.nome)) = dg.norm_nome
    WHERE c.id != dg.keep_id
)
DELETE FROM fontes_renda c USING mapping WHERE c.id = mapping.old_id;
