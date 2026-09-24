-- Caixinhas: substituem Fundos, Conf. Fundos, Emergência e Metas.
-- Cria as tabelas novas e traz, para cada usuário, os fundos (saldo e histórico mês a mês) e as metas.
-- As tabelas antigas (fundos, contribuicoes, metas, config.pct_*) NÃO são alteradas nem apagadas.
-- Pode rodar de novo sem duplicar: quem já tem caixinhas é pulado.

create table if not exists public.caixinhas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  icone text not null default 'piggy',
  tipo text not null default 'normal' check (tipo in ('normal', 'emergencia')),
  meta numeric(12,2) check (meta is null or meta > 0),        -- vazio = sem meta (emergência: 6x despesas)
  prazo date,
  valor_mensal numeric(12,2) not null default 0 check (valor_mensal >= 0),  -- sugestão do "Guardar do mês"
  onde text,                                                   -- ex.: PicPay, XP
  ordem integer not null default 0,
  arquivada boolean not null default false,
  origem text,                                                 -- de onde veio na migração (fundo:fixo, meta:<id>)
  created_at timestamptz not null default now()
);

-- guardar/resgatar: valor positivo. ajuste: com sinal (rendimento, correção, saldo inicial).
create table if not exists public.caixinha_movimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  caixinha_id uuid not null references public.caixinhas(id) on delete cascade,
  data date not null,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  tipo text not null check (tipo in ('guardar', 'resgatar', 'ajuste')),
  valor numeric(12,2) not null,
  descricao text,
  created_at timestamptz not null default now(),
  check (tipo = 'ajuste' or valor > 0)
);

create index if not exists caixinhas_user on public.caixinhas (user_id);
create index if not exists caixinha_mov_user_mes on public.caixinha_movimentos (user_id, mes);
create index if not exists caixinha_mov_caixinha on public.caixinha_movimentos (caixinha_id);
create unique index if not exists caixinhas_uma_emergencia on public.caixinhas (user_id) where tipo = 'emergencia';

do $$
declare t text;
begin
  foreach t in array array['caixinhas', 'caixinha_movimentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format('create policy "dono" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------- migração dos dados ----------------
do $$
declare
  u record;
  slots text[] := array['fixo', 'emergencia', 'outro', 'fundo4', 'fundo5'];
  nomes_padrao text[] := array['Renda Fixa', 'Emergência', '3º Fundo', 'Fundo 4', 'Fundo 5'];
  icones text[] := array['trending', 'shield', 'piggy', 'piggy', 'piggy'];
  i int;
  slot text;
  nome_cfg text;
  mensal numeric;
  saldo numeric;
  contrib numeric;
  gastos numeric;
  ajuste numeric;
  cid uuid;
  m record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  for u in
    select c.user_id, to_jsonb(c) as cj,
           (select to_jsonb(f) from public.fundos f where f.user_id = c.user_id order by f.id limit 1) as fj
    from (select distinct on (user_id) * from public.config order by user_id) c
  loop
    if exists (select 1 from public.caixinhas x where x.user_id = u.user_id) then
      continue;
    end if;

    for i in 1..5 loop
      slot := slots[i];
      nome_cfg := nullif(trim(u.cj ->> (slot || '_nome')), '');
      mensal := coalesce((u.cj ->> ('pct_' || slot))::numeric, 0);
      saldo := coalesce((u.fj ->> (slot || '_saldo'))::numeric, 0);
      select coalesce(sum((to_jsonb(ct) ->> (slot || '_valor'))::numeric), 0) into contrib
        from public.contribuicoes ct where ct.user_id = u.user_id;

      gastos := 0;
      if slot = 'emergencia' then
        select coalesce(sum(l.valor), 0) into gastos
          from public.lancamentos l join public.categorias cat on cat.id = l.categoria_id
         where l.user_id = u.user_id and l.tipo = 'despesa'
           and (lower(cat.nome) like '%emergên%' or lower(cat.nome) like '%emergencia%');
      end if;

      -- Emergência sempre existe; os outros só se foram usados.
      if slot <> 'emergencia' and nome_cfg is null and mensal = 0 and saldo = 0 and contrib = 0 then
        continue;
      end if;

      insert into public.caixinhas (user_id, nome, icone, tipo, valor_mensal, ordem, origem)
      values (u.user_id, coalesce(nome_cfg, nomes_padrao[i]), icones[i],
              case when slot = 'emergencia' then 'emergencia' else 'normal' end,
              mensal, i, 'fundo:' || slot)
      returning id into cid;

      -- histórico mês a mês (é o que já saiu do "Líquido p/ Gastos" de cada mês)
      insert into public.caixinha_movimentos (user_id, caixinha_id, data, mes, tipo, valor, descricao)
      select ct.user_id, cid, (ct.mes || '-01')::date, ct.mes, 'guardar',
             (to_jsonb(ct) ->> (slot || '_valor'))::numeric, 'Guardado (Fundos)'
        from public.contribuicoes ct
       where ct.user_id = u.user_id and coalesce((to_jsonb(ct) ->> (slot || '_valor'))::numeric, 0) > 0;

      -- diferença entre o saldo de hoje e o histórico (gastos de emergência já contam à parte)
      ajuste := saldo - contrib + gastos;
      if abs(ajuste) >= 0.01 then
        insert into public.caixinha_movimentos (user_id, caixinha_id, data, mes, tipo, valor, descricao)
        values (u.user_id, cid, hoje, to_char(hoje, 'YYYY-MM'), 'ajuste', round(ajuste, 2), 'Saldo trazido dos Fundos');
      end if;
    end loop;

    -- metas viram caixinhas com meta e prazo
    for m in select * from public.metas mt where mt.user_id = u.user_id order by mt.created_at loop
      insert into public.caixinhas (user_id, nome, icone, meta, prazo, ordem, origem)
      values (u.user_id, m.nome, 'target', nullif(m.valor_total, 0),
              case when coalesce(m.prazo_meses, 0) > 0 then (m.created_at + make_interval(months => m.prazo_meses))::date end,
              10, 'meta:' || m.id)
      returning id into cid;
      if coalesce(m.valor_atual, 0) <> 0 then
        insert into public.caixinha_movimentos (user_id, caixinha_id, data, mes, tipo, valor, descricao)
        values (u.user_id, cid, hoje, to_char(hoje, 'YYYY-MM'), 'ajuste', m.valor_atual, 'Valor que já estava na meta');
      end if;
    end loop;
  end loop;
end $$;

-- Conferência (só leitura): saldo de cada caixinha por usuário.
-- select u.email, c.nome, c.tipo, sum(case when mv.tipo = 'resgatar' then -mv.valor else mv.valor end) as movimentos
-- from public.caixinhas c join auth.users u on u.id = c.user_id
-- left join public.caixinha_movimentos mv on mv.caixinha_id = c.id
-- group by u.email, c.nome, c.tipo order by u.email, c.nome;
