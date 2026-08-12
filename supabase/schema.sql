-- Ev Stok: ortak ürün listesi
create table if not exists public.items (
  id uuid primary key,
  name text not null,
  needed_qty numeric not null default 1,
  current_qty numeric not null default 0,
  unit text not null default 'adet',
  due_date date not null,
  renewal_days integer,
  purchased boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.items enable row level security;

-- Kişisel ev uygulaması: giriş yok, anon okuma/yazma (sadece bu proje anahtarıyla)
drop policy if exists "items_select_anon" on public.items;
drop policy if exists "items_insert_anon" on public.items;
drop policy if exists "items_update_anon" on public.items;
drop policy if exists "items_delete_anon" on public.items;

create policy "items_select_anon" on public.items for select to anon using (true);
create policy "items_insert_anon" on public.items for insert to anon with check (true);
create policy "items_update_anon" on public.items for update to anon using (true) with check (true);
create policy "items_delete_anon" on public.items for delete to anon using (true);

alter publication supabase_realtime add table public.items;
