-- Lembrete semanal por notificação (Web Push).
-- 1) Cada aparelho que ativa o lembrete vira uma linha em lembrete_inscricoes (dia e hora escolhidos).
-- 2) O pg_cron roda de hora em hora a função privado.lembretes_disparar(), que junta quem deve
--    receber agora e manda para o app (/api/lembretes) via pg_net; o app assina e envia as notificações.
-- O segredo e o endereço do app ficam em privado.lembrete_config (arquivo separado, fora do git).
-- Não altera nenhuma tabela existente.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.lembrete_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dia_semana integer not null default 0 check (dia_semana between 0 and 6),  -- 0 = domingo
  hora integer not null default 20 check (hora between 0 and 23),
  fuso text not null default 'America/Sao_Paulo',
  aparelho text,
  ativo boolean not null default true,
  ultimo_envio timestamptz,
  created_at timestamptz not null default now()
);

alter table public.lembrete_inscricoes enable row level security;
drop policy if exists "dono" on public.lembrete_inscricoes;
create policy "dono" on public.lembrete_inscricoes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Inscreve este aparelho na conta de quem está logado. Se o mesmo navegador estava em outra conta,
-- a inscrição passa para a conta atual (por isso roda como dono da tabela).
create or replace function public.lembrete_inscrever(p_endpoint text, p_p256dh text, p_auth text,
                                                     p_dia integer, p_hora integer, p_fuso text, p_aparelho text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'precisa estar logado'; end if;
  delete from public.lembrete_inscricoes where endpoint = p_endpoint;
  insert into public.lembrete_inscricoes (user_id, endpoint, p256dh, auth, dia_semana, hora, fuso, aparelho)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_dia, p_hora, coalesce(p_fuso, 'America/Sao_Paulo'), p_aparelho);
end $$;
revoke all on function public.lembrete_inscrever(text, text, text, integer, integer, text, text) from public, anon;
grant execute on function public.lembrete_inscrever(text, text, text, integer, integer, text, text) to authenticated;

-- Configuração privada (fora da API do Supabase).
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
create table if not exists privado.lembrete_config (
  id integer primary key default 1 check (id = 1),
  url text not null,
  segredo text not null
);

-- O app chama isto para apagar inscrições que o navegador invalidou (aparelho trocado, permissão retirada).
create or replace function public.lembrete_desativar(p_segredo text, p_endpoints text[])
returns integer language plpgsql security definer set search_path = public, privado as $$
declare n integer;
begin
  if not exists (select 1 from privado.lembrete_config where segredo = p_segredo) then
    raise exception 'não autorizado';
  end if;
  delete from public.lembrete_inscricoes where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.lembrete_desativar(text, text[]) from public;
grant execute on function public.lembrete_desativar(text, text[]) to anon, authenticated;

create or replace function privado.lembretes_disparar()
returns void language plpgsql security definer set search_path = public, privado as $$
declare
  cfg record;
  itens jsonb;
begin
  select * into cfg from privado.lembrete_config where id = 1;
  if cfg is null then return; end if;

  with devidos as (
    select i.* from public.lembrete_inscricoes i
    where i.ativo
      and extract(dow from now() at time zone i.fuso) = i.dia_semana
      and extract(hour from now() at time zone i.fuso) = i.hora
      and (i.ultimo_envio is null or i.ultimo_envio < now() - interval '20 hours')
  ), marcados as (
    update public.lembrete_inscricoes i set ultimo_envio = now()
    from devidos d where i.id = d.id
    returning i.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'endpoint', m.endpoint, 'p256dh', m.p256dh, 'auth', m.auth,
           'nome', coalesce(u.raw_user_meta_data ->> 'display_name', ''),
           'porque', u.raw_user_meta_data ->> 'porque',
           'lancamentos_semana', (
             select count(*) from public.lancamentos l
             where l.user_id = m.user_id
               and l.created_at >= (date_trunc('week', now() at time zone m.fuso) at time zone m.fuso)
           )
         )), '[]'::jsonb)
    into itens
  from marcados m join auth.users u on u.id = m.user_id;

  if jsonb_array_length(itens) = 0 then return; end if;

  perform net.http_post(
    url := cfg.url,
    body := jsonb_build_object('itens', itens),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-segredo', cfg.segredo),
    timeout_milliseconds := 15000
  );
end $$;

-- De hora em hora, no minuto 0.
select cron.unschedule('finfamily-lembretes') where exists (select 1 from cron.job where jobname = 'finfamily-lembretes');
select cron.schedule('finfamily-lembretes', '0 * * * *', 'select privado.lembretes_disparar()');
