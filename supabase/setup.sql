-- Baska: database setup for Supabase
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run more than once.

-- 1. People ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Lists and who can see them -------------------------------------------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  share_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 10),
  created_at timestamptz not null default now()
);

create table if not exists public.list_members (
  list_id uuid not null references public.lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

create or replace function public.is_list_member(p_list_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.list_members
    where list_id = p_list_id and user_id = auth.uid()
  );
$$;

-- 3. Items -----------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  name text not null,
  qty integer not null default 1,
  store text not null default '',
  note text not null default '',
  status text not null default 'needed'
    check (status in ('needed', 'got', 'out', 'substituted')),
  status_note text not null default '',
  added_by uuid default auth.uid() references auth.users (id) on delete set null,
  added_by_name text not null default '',
  updated_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who the item is for (added later; safe to run on an existing database)
alter table public.items add column if not exists assigned_to text not null default '';

create index if not exists items_list_id_idx on public.items (list_id);

-- Stamp who added / last updated an item, and when
create or replace function public.stamp_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  who text;
begin
  select display_name into who from public.profiles where id = auth.uid();
  who := coalesce(who, '');
  if tg_op = 'INSERT' then
    new.added_by := auth.uid();
    new.added_by_name := who;
    new.updated_by_name := who;
  else
    new.added_by := old.added_by;
    new.added_by_name := old.added_by_name;
    new.updated_by_name := who;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists items_stamp on public.items;
create trigger items_stamp
  before insert or update on public.items
  for each row execute function public.stamp_item();

-- 4. Actions the app calls -------------------------------------------------
create or replace function public.create_list(p_name text)
returns public.lists language plpgsql security definer set search_path = public as $$
declare
  new_list public.lists;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.lists (name, owner_id)
  values (coalesce(nullif(trim(p_name), ''), 'Shopping list'), auth.uid())
  returning * into new_list;
  insert into public.list_members (list_id, user_id) values (new_list.id, auth.uid());
  return new_list;
end;
$$;

create or replace function public.join_list(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into target from public.lists where share_code = trim(p_code);
  if target is null then raise exception 'This share link is not valid'; end if;
  insert into public.list_members (list_id, user_id)
  values (target, auth.uid())
  on conflict do nothing;
  return target;
end;
$$;

-- 5. Security rules: people only see lists they belong to -----------------
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.items enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "members see list" on public.lists;
create policy "members see list" on public.lists
  for select to authenticated using (public.is_list_member(id));
drop policy if exists "owner renames list" on public.lists;
create policy "owner renames list" on public.lists
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner deletes list" on public.lists;
create policy "owner deletes list" on public.lists
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "members see members" on public.list_members;
create policy "members see members" on public.list_members
  for select to authenticated using (public.is_list_member(list_id));
drop policy if exists "leave a list" on public.list_members;
create policy "leave a list" on public.list_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members read items" on public.items;
create policy "members read items" on public.items
  for select to authenticated using (public.is_list_member(list_id));
drop policy if exists "members add items" on public.items;
create policy "members add items" on public.items
  for insert to authenticated with check (public.is_list_member(list_id));
drop policy if exists "members update items" on public.items;
create policy "members update items" on public.items
  for update to authenticated using (public.is_list_member(list_id)) with check (public.is_list_member(list_id));
drop policy if exists "members delete items" on public.items;
create policy "members delete items" on public.items
  for delete to authenticated using (public.is_list_member(list_id));

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.lists to authenticated;
grant select, delete on public.list_members to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant execute on function public.create_list(text) to authenticated;
grant execute on function public.join_list(text) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
revoke execute on function public.create_list(text) from anon, public;
revoke execute on function public.join_list(text) from anon, public;

-- 6. Live updates: send item changes to everyone's screen instantly -------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;
