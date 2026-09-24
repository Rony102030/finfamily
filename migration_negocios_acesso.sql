-- Área Negócios liberada por conta. Quem não tem linha aqui vê "Negócios" com cadeado.
-- Os usuários só conseguem LER o próprio acesso; liberar é feito aqui no SQL Editor.
-- Rodar depois de migration_hora_do_frango.sql.

create table if not exists public.negocios_acesso (
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null,               -- 'frango', 'servico_extra', ...
  created_at timestamptz not null default now(),
  primary key (user_id, modulo)
);

alter table public.negocios_acesso enable row level security;
drop policy if exists "ver o proprio acesso" on public.negocios_acesso;
create policy "ver o proprio acesso" on public.negocios_acesso
  for select using (auth.uid() = user_id);

-- Tabelas da Hora do Frango: além de ser dono do registro, precisa ter o módulo 'frango' liberado.
do $$
declare t text;
begin
  foreach t in array array['frango_config', 'frango_custos_fixos', 'frango_clientes', 'frango_compras',
                           'frango_custos', 'frango_fechamentos', 'frango_fiados', 'frango_recebimentos']
  loop
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format($p$create policy "dono" on public.%I for all
      using (auth.uid() = user_id and exists (select 1 from public.negocios_acesso a where a.user_id = auth.uid() and a.modulo = 'frango'))
      with check (auth.uid() = user_id and exists (select 1 from public.negocios_acesso a where a.user_id = auth.uid() and a.modulo = 'frango'))$p$, t);
  end loop;
end $$;

-- Conta do Rony: Hora do Frango e Serviço Extra (TikTok) liberados.
insert into public.negocios_acesso (user_id, modulo)
select u.id, m.modulo
from auth.users u
cross join (values ('frango'), ('servico_extra')) as m(modulo)
where u.email = 'silvaronycleio@gmail.com'
on conflict do nothing;

-- Para liberar um módulo para outra pessoa no futuro:
--   insert into public.negocios_acesso (user_id, modulo)
--   select id, 'NOME_DO_MODULO' from auth.users where email = 'email@da.pessoa';
-- Para tirar:
--   delete from public.negocios_acesso
--   where modulo = 'NOME_DO_MODULO' and user_id = (select id from auth.users where email = 'email@da.pessoa');
