-- Mobil özellikler için web şema güncellemesi
-- Supabase SQL Editor'de bir kez çalıştırın.

alter table public.household_members
  add column if not exists role text not null default 'member',
  add column if not exists display_name text not null default 'Üye',
  add column if not exists email text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'household_members_role_check'
  ) then
    alter table public.household_members
      add constraint household_members_role_check
      check (role in ('owner', 'member'));
  end if;
end $$;

-- Mevcut ilk üye (en eski) kurucu olsun
update public.household_members hm
set role = 'owner'
where hm.joined_at = (
  select min(hm2.joined_at)
  from public.household_members hm2
  where hm2.household_id = hm.household_id
)
and not exists (
  select 1 from public.household_members o
  where o.household_id = hm.household_id and o.role = 'owner'
);

alter table public.items
  add column if not exists purchased_place_id text,
  add column if not exists purchased_place_label text;

create or replace function public.my_household_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

drop policy if exists "members_select" on public.household_members;
create policy "members_select" on public.household_members
  for select to authenticated
  using (household_id in (select public.my_household_ids()));

drop policy if exists "members_update_self" on public.household_members;
create policy "members_update_self" on public.household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

  insert into public.household_members (household_id, user_id, role, display_name, email)
  values (v_row.id, auth.uid(), 'owner', 'Üye', '');

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

  insert into public.household_members (household_id, user_id, role, display_name, email)
  values (v_row.id, auth.uid(), 'member', 'Üye', '')
  on conflict do nothing;

  return v_row;
end;
$$;

create or replace function public.remove_household_member(p_household_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_role text;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;

  select role into v_my_role
  from public.household_members
  where household_id = p_household_id and user_id = auth.uid();

  if v_my_role is distinct from 'owner' then
    raise exception 'Sadece kurucu üye çıkarabilir';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Kendini çıkarmak için aileden ayrıl';
  end if;

  select role into v_target_role
  from public.household_members
  where household_id = p_household_id and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Üye bulunamadı';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Kurucu çıkarılamaz';
  end if;

  delete from public.household_members
  where household_id = p_household_id and user_id = p_user_id;
end;
$$;

create or replace function public.leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_role text;
  v_others int;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;

  select role into v_my_role
  from public.household_members
  where household_id = p_household_id and user_id = auth.uid();

  if v_my_role is null then
    raise exception 'Üyelik bulunamadı';
  end if;

  if v_my_role = 'owner' then
    select count(*) into v_others
    from public.household_members
    where household_id = p_household_id and user_id <> auth.uid();
    if v_others > 0 then
      raise exception 'Kurucu ayrılmadan önce diğer üyeleri çıkarmalı';
    end if;
  end if;

  delete from public.household_members
  where household_id = p_household_id and user_id = auth.uid();
end;
$$;

create or replace function public.update_my_member_profile(
  p_household_id uuid,
  p_display_name text,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli';
  end if;

  update public.household_members
  set
    display_name = coalesce(nullif(trim(p_display_name), ''), 'Üye'),
    email = coalesce(trim(p_email), '')
  where household_id = p_household_id and user_id = auth.uid();

  if not found then
    raise exception 'Üyelik bulunamadı';
  end if;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.update_my_member_profile(uuid, text, text) to authenticated;
