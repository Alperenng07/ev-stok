-- Sadece bu kısa sorguyu çalıştır (Run)
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

update public.items
set household_id = 'a1111111-1111-4111-8111-111111111111'
where household_id is null;
