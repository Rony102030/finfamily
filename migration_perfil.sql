-- Foto de perfil: bucket "avatars" no Supabase Storage.
-- Cada pessoa só grava, troca e apaga arquivos na própria pasta (avatars/<id do usuário>/...).
-- A leitura é pública pelo link da foto (o nome do arquivo é aleatório).
-- Não altera nenhuma tabela do app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars: ver a propria pasta" on storage.objects;
drop policy if exists "avatars: enviar na propria pasta" on storage.objects;
drop policy if exists "avatars: trocar na propria pasta" on storage.objects;
drop policy if exists "avatars: apagar na propria pasta" on storage.objects;

create policy "avatars: ver a propria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: enviar na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: trocar na propria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: apagar na propria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
