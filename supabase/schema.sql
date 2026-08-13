-- Ev Stok aile şeması (tek seferde çalıştır)
-- SQL Editor → New query → yapıştır → sağ alttaki RUN

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_idx
  on public.household_members (user_id);

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

alter table public.items
  add column if not exists household_id uuid references public.households (id) on delete cascade;

insert into public.households (id, name, invite_code)
values (
  'a1111111-1111-4111-8111-111111111111',
  'Bizim Ev',
  'TURKSOYS'
)
on conflict (id) do update
set
  name = excluded.name,
  invite_code = excluded.invite_code;

-- Eski BIZIMEV kodunu da temizle (varsa)
update public.households
set invite_code = 'TURKSOYS'
where invite_code = 'BIZIMEV';

update public.items
set household_id = 'a1111111-1111-4111-8111-111111111111'
where household_id is null;

do $$
begin
  if exists (
    select 1 from public.items where household_id is null
  ) then
    raise exception 'household_id boş kalan ürün var';
  end if;
end $$;

alter table public.items
  alter column household_id set not null;

create index if not exists items_household_idx on public.items (household_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.items enable row level security;

drop policy if exists "items_select_anon" on public.items;
drop policy if exists "items_insert_anon" on public.items;
drop policy if exists "items_update_anon" on public.items;
drop policy if exists "items_delete_anon" on public.items;
drop policy if exists "households_select" on public.households;
drop policy if exists "members_select" on public.household_members;
drop policy if exists "items_select" on public.items;
drop policy if exists "items_insert" on public.items;
drop policy if exists "items_update" on public.items;
drop policy if exists "items_delete" on public.items;

create policy "households_select" on public.households
  for select to authenticated
  using (
    id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

create policy "members_select" on public.household_members
  for select to authenticated
  using (user_id = auth.uid());

create policy "items_select" on public.items
  for select to authenticated
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

create policy "items_insert" on public.items
  for insert to authenticated
  with check (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

create policy "items_update" on public.items
  for update to authenticated
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

create policy "items_delete" on public.items
  for delete to authenticated
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_row public.households;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Aile adı en az 2 karakter olmalı';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.households where invite_code = v_code);
  end loop;

  insert into public.households (name, invite_code)
  values (trim(p_name), v_code)
  returning * into v_row;

  insert into public.household_members (household_id, user_id)
  values (v_row.id, auth.uid());

  return v_row;
end;
$$;

create or replace function public.join_household(p_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.households;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;

  select * into v_row
  from public.households
  where invite_code = upper(trim(p_code));

  if not found then
    raise exception 'Davet kodu bulunamadı';
  end if;

  insert into public.household_members (household_id, user_id)
  values (v_row.id, auth.uid())
  on conflict do nothing;

  return v_row;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
