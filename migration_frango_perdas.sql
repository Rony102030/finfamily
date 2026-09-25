-- Hora do Frango: perdas no estoque (frango que estragou, venceu ou se perdeu antes de ser assado).
-- Só acrescenta uma tabela nova; não mexe em nada que já existe.

create table if not exists public.frango_perdas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data date not null,
  qtd integer not null check (qtd > 0),
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists frango_perdas_user_data on public.frango_perdas (user_id, data);

alter table public.frango_perdas enable row level security;

-- mesma regra das outras tabelas do frango: só o dono, e só com o módulo 'frango' liberado
drop policy if exists "dono" on public.frango_perdas;
create policy "dono" on public.frango_perdas for all
  using (auth.uid() = user_id and exists (select 1 from public.negocios_acesso a where a.user_id = auth.uid() and a.modulo = 'frango'))
  with check (auth.uid() = user_id and exists (select 1 from public.negocios_acesso a where a.user_id = auth.uid() and a.modulo = 'frango'));
