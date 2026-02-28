CREATE TABLE public.subcategorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now()
);

ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subcategorias."
  ON public.subcategorias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subcategorias."
  ON public.subcategorias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subcategorias."
  ON public.subcategorias FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subcategorias."
  ON public.subcategorias FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE public.lancamentos ADD COLUMN subcategoria_id uuid references public.subcategorias(id) on delete set null;
