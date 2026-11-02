-- Nodle: database setup. Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
-- It is safe to run again (it will not delete anything).
--
-- What this stores: ONE row per person who logs in. The row holds only scrambled (AES-GCM encrypted)
-- text made in the browser with the vault passphrase. The database never sees names, notes or anything readable,
-- and the passphrase is never sent, so neither Supabase nor anyone running this app can read your contacts.

create table if not exists public.vaults (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  ciphertext text        not null,                 -- base64 of the encrypted data (opaque)
  iv         text        not null,                 -- base64 random 12-byte nonce for this save
  salt       text        not null,                 -- base64 random 16-byte salt for the passphrase key
  kdf_iter   integer     not null check (kdf_iter >= 310000),  -- PBKDF2-SHA256 rounds used (app uses 600000)
  version    integer     not null default 1 check (version >= 1), -- goes up by 1 on every save (stops two devices overwriting each other)
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;
alter table public.vaults force row level security;

-- Each logged-in user can see and change ONLY their own row. There is no policy for anonymous visitors
-- and none for DELETE, so nobody (including the app) can delete the vault through the API.
drop policy if exists "vault select own" on public.vaults;
drop policy if exists "vault insert own" on public.vaults;
drop policy if exists "vault update own" on public.vaults;

create policy "vault select own" on public.vaults for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "vault insert own" on public.vaults for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "vault update own" on public.vaults for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Belt and braces: take away every table right the app does not need.
revoke all on public.vaults from anon;
revoke all on public.vaults from authenticated;
grant select, insert, update on public.vaults to authenticated;

-- A save only succeeds if it is exactly "old version + 1", and the owner can never be changed.
-- (The app also checks this itself; this makes it impossible to bypass.)
create or replace function public.vaults_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
    new.updated_at := now();
    return new;
  end if;
  if new.user_id <> old.user_id then
    raise exception 'user_id cannot be changed' using errcode = '42501';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'version conflict' using errcode = '40001';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists vaults_guard on public.vaults;
create trigger vaults_guard before insert or update on public.vaults
  for each row execute function public.vaults_guard();

-- OPTIONAL (only after you have turned on two-step sign-in in the app and it works):
-- make the database itself refuse anyone who signed in without the 6-digit code. Uncomment, then Run.
-- create policy "vault needs two-step" on public.vaults as restrictive for all to authenticated
--   using ((select auth.jwt() ->> 'aal') = 'aal2');
