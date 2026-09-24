-- Hora do Frango: aba "Meu Negócio" do FinFamily.
-- Só cria tabelas novas (prefixo frango_). Não altera nenhuma tabela existente.
-- Rodar uma vez no Supabase: SQL Editor > New query > colar tudo > Run.

create table if not exists public.frango_config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nome text not null default 'Hora do Frango',
  preco_grande numeric(10,2) not null default 50,
  preco_padrao numeric(10,2) not null default 45,
  kg_por_caixa numeric(6,2) not null default 20,
  meta_mensal integer not null default 160,
  template_whatsapp text not null default 'Oi {nome}, ficou {valor} do frango do dia {data}. Pode acertar essa semana?',
  created_at timestamptz not null default now()
);

create table if not exists public.frango_custos_fixos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric(10,2) not null check (valor >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.frango_clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  telefone text,
  created_at timestamptz not null default now()
);

-- Compra de frango: cada item de "caixas" é uma caixa com N frangos (vira um lote no estoque).
create table if not exists public.frango_compras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  preco_kg numeric(10,2) not null check (preco_kg > 0),
  kg_por_caixa numeric(6,2) not null check (kg_por_caixa > 0),
  caixas integer[] not null check (cardinality(caixas) > 0),
  observacao text,
  created_at timestamptz not null default now()
);

-- Outros custos (tempero, embalagem, gás...) e custos fixos do mês (fixo_id preenchido).
create table if not exists public.frango_custos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  categoria text not null,
  valor numeric(10,2) not null check (valor >= 0),
  descricao text,
  fixo_id uuid references public.frango_custos_fixos(id) on delete set null,
  mes text,
  created_at timestamptz not null default now(),
  unique (fixo_id, mes)
);

-- Fechamento do dia de venda. Preços gravados no dia (a config pode mudar depois).
create table if not exists public.frango_fechamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  farofa boolean not null default false,
  assados integer not null check (assados >= 0),
  vend_grande integer not null default 0 check (vend_grande >= 0),
  vend_padrao integer not null default 0 check (vend_padrao >= 0),
  preco_grande numeric(10,2) not null,
  preco_padrao numeric(10,2) not null,
  rec_dinheiro numeric(10,2) not null default 0,
  rec_pix numeric(10,2) not null default 0,
  rec_cartao numeric(10,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  unique (user_id, data)
);

-- Fiado: nasce num fechamento (fechamento_id) ou é um fiado antigo lançado à parte.
create table if not exists public.frango_fiados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid not null references public.frango_clientes(id) on delete restrict,
  fechamento_id uuid references public.frango_fechamentos(id) on delete cascade,
  data date not null,
  qtd integer not null default 1 check (qtd >= 0),
  preco_un numeric(10,2),
  valor numeric(10,2) not null check (valor > 0),
  status text not null default 'aberto' check (status in ('aberto', 'pago', 'perdido')),
  data_baixa date,
  created_at timestamptz not null default now()
);

create table if not exists public.frango_recebimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fiado_id uuid not null references public.frango_fiados(id) on delete cascade,
  data date not null,
  valor numeric(10,2) not null check (valor > 0),
  forma text not null check (forma in ('dinheiro', 'pix', 'cartao')),
  created_at timestamptz not null default now()
);

create index if not exists frango_custos_user_data on public.frango_custos (user_id, data);
create index if not exists frango_fiados_user_status on public.frango_fiados (user_id, status);
create index if not exists frango_recebimentos_fiado on public.frango_recebimentos (fiado_id);

-- Cada usuário só vê e mexe nos próprios registros.
do $$
declare t text;
begin
  foreach t in array array['frango_config', 'frango_custos_fixos', 'frango_clientes', 'frango_compras',
                           'frango_custos', 'frango_fechamentos', 'frango_fiados', 'frango_recebimentos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format('create policy "dono" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
