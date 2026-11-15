-- Baska update: lets each item record who it's for.
-- If nobody is picked, the item belongs to its direct sender (the last person who sent it).
-- Paste into Supabase > SQL Editor > New query, then click Run. Safe to run more than once.

alter table public.items add column if not exists assigned_to text not null default '';

-- Existing items with no person: give them to the last person who sent or changed them
alter table public.items disable trigger items_stamp;
update public.items
set assigned_to = coalesce(nullif(trim(updated_by_name), ''), added_by_name)
where coalesce(trim(assigned_to), '') = '';
alter table public.items enable trigger items_stamp;

-- New and edited items: fill in the person automatically when it's left empty
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
    -- No person picked: the sender owns it
    if coalesce(trim(new.assigned_to), '') = '' then
      new.assigned_to := who;
    end if;
  else
    new.added_by := old.added_by;
    new.added_by_name := old.added_by_name;
    new.updated_by_name := who;
    -- Left empty: the direct sender (whoever is making this change) takes ownership
    if coalesce(trim(new.assigned_to), '') = '' then
      new.assigned_to := who;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
