-- Hatırlatma mailleri (her aile kendi adreslerini ekler)
-- SQL Editor → Run

create table if not exists public.reminder_emails (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (household_id, email)
);

create index if not exists reminder_emails_household_idx
  on public.reminder_emails (household_id);

alter table public.reminder_emails enable row level security;

drop policy if exists "reminder_emails_select" on public.reminder_emails;
drop policy if exists "reminder_emails_insert" on public.reminder_emails;
drop policy if exists "reminder_emails_delete" on public.reminder_emails;

create policy "reminder_emails_select" on public.reminder_emails
  for select to authenticated
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

create policy "reminder_emails_insert" on public.reminder_emails
  for insert to authenticated
  with check (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

create policy "reminder_emails_delete" on public.reminder_emails
  for delete to authenticated
  using (
    household_id in (
      select household_id from public.household_members where user_id = auth.uid()
    )
  );

-- Sizin ailenizin mailleri (TURKSOYS)
insert into public.reminder_emails (household_id, email)
values
  ('a1111111-1111-4111-8111-111111111111', 'alperenturksoy0110@gmail.com'),
  ('a1111111-1111-4111-8111-111111111111', 'balkesdilan07@gmail.com')
on conflict (household_id, email) do nothing;
