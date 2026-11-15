-- Baska update: lets each item record who it's for.
-- Paste into Supabase > SQL Editor > New query, then click Run. Safe to run more than once.
alter table public.items add column if not exists assigned_to text not null default '';
