-- Melhorias de outubro/2026. Só ACRESCENTA colunas e tabelas; não apaga nem altera dados existentes,
-- exceto preencher a data do pagamento das contas que já estão pagas (com a própria data do lançamento).

-- 1) Data do pagamento dos lançamentos -------------------------------------------------------------
alter table public.lancamentos add column if not exists data_pagamento date;

-- contas que já estão pagas: não há como saber a data real, usa a data do lançamento
update public.lancamentos set data_pagamento = coalesce(data, (created_at at time zone 'America/Sao_Paulo')::date)
 where status = 'pago' and data_pagamento is null;

-- Regra automática (vale para o app, o conector e qualquer outro caminho):
--  * criado já como pago            -> data do pagamento = data do lançamento
--  * mudou de pendente para pago    -> hoje (horário de Brasília), salvo se a data vier informada
--  * voltou para pendente           -> apaga a data do pagamento
create or replace function public.lancamentos_data_pagamento() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'pago' then
    if tg_op = 'INSERT' then
      new.data_pagamento := coalesce(new.data_pagamento, new.data, (now() at time zone 'America/Sao_Paulo')::date);
    elsif old.status is distinct from 'pago' and new.data_pagamento is not distinct from old.data_pagamento then
      new.data_pagamento := (now() at time zone 'America/Sao_Paulo')::date;
    elsif new.data_pagamento is null then
      new.data_pagamento := coalesce(new.data, (now() at time zone 'America/Sao_Paulo')::date);
    end if;
  else
    new.data_pagamento := null;
  end if;
  return new;
end $$;

drop trigger if exists lancamentos_data_pagamento on public.lancamentos;
create trigger lancamentos_data_pagamento before insert or update on public.lancamentos
  for each row execute function public.lancamentos_data_pagamento();

-- 2) Hora do Frango: preço livre e procura não atendida no fechamento ------------------------------
alter table public.frango_fechamentos add column if not exists vendas_outras jsonb not null default '[]'::jsonb;  -- [{"qtd": 1, "preco": 40}]
alter table public.frango_fechamentos add column if not exists procura_nao_atendida integer not null default 0 check (procura_nao_atendida >= 0);

-- 3) Hora do Frango: com o que cada compra/custo foi pago (para o saldo do caixa e a conta com o dono)
--    'dinheiro' = caixa em dinheiro; 'pix' = conta (Pix/cartão); 'dono' = o dono pagou do bolso
alter table public.frango_custos  add column if not exists pago_com text check (pago_com in ('dinheiro', 'pix', 'dono'));
alter table public.frango_compras add column if not exists pago_com text check (pago_com in ('dinheiro', 'pix', 'dono'));

-- saldo conferido do caixa: a partir desta data o app soma entradas e saídas
alter table public.frango_config add column if not exists caixa_data date;
alter table public.frango_config add column if not exists caixa_dinheiro numeric(10,2) not null default 0;
alter table public.frango_config add column if not exists caixa_pix numeric(10,2) not null default 0;

-- 4) Hora do Frango: venda de frango cru (sai do estoque) ------------------------------------------
create table if not exists public.frango_vendas_cru (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  qtd integer not null check (qtd > 0),
  preco_un numeric(10,2) not null check (preco_un >= 0),
  temperado boolean not null default false,
  forma text not null default 'dinheiro' check (forma in ('dinheiro', 'pix', 'cartao')),
  observacao text,
  created_at timestamptz not null default now()
);
create index if not exists frango_vendas_cru_user_data on public.frango_vendas_cru (user_id, data);

-- 5) Hora do Frango: conta corrente com o dono ------------------------------------------------------
--  pro_labore = o negócio passa a dever ao dono; retirada = o dono tirou do caixa (o negócio deve menos);
--  aporte = o dono colocou dinheiro no caixa (o negócio deve mais).
--  Custos pagos do bolso do dono (pago_com = 'dono') também contam como dívida com o dono.
create table if not exists public.frango_conta_dono (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('pro_labore', 'retirada', 'aporte')),
  valor numeric(10,2) not null check (valor > 0),
  forma text check (forma in ('dinheiro', 'pix')),
  descricao text,
  created_at timestamptz not null default now()
);
create index if not exists frango_conta_dono_user_data on public.frango_conta_dono (user_id, data);

-- mesma regra das outras tabelas do frango: só o dono, e só com o módulo 'frango' liberado
do $$
declare t text;
begin
  foreach t in array array['frango_vendas_cru', 'frango_conta_dono'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format($p$create policy "dono" on public.%I for all
      using (auth.uid() = user_id and exists (select 1 from public.negocios_acesso a where a.user_id = auth.uid() and a.modulo = 'frango'))
      with check (auth.uid() = user_id and exists (select 1 from public.negocios_acesso a where a.user_id = auth.uid() and a.modulo = 'frango'))$p$, t);
  end loop;
end $$;
