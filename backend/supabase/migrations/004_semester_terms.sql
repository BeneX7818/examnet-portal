-- ========== SEMESTER TERMS (run once) ==========
-- Every registration belongs to a semester. Student IDs stay unique across ALL
-- semesters (on purpose); usernames and name+room are unique per semester.
create table if not exists public.exam_terms (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists exam_terms_label_key on public.exam_terms (lower(label));
create unique index if not exists exam_terms_one_active on public.exam_terms (is_active) where is_active;

alter table public.exam_terms enable row level security;
drop policy if exists "Allow public read exam_terms" on public.exam_terms;
create policy "Allow public read exam_terms" on public.exam_terms for select using (true);
-- No insert/update/delete policy: semesters change only through the functions below.

-- Your current records become the first semester:
insert into public.exam_terms (label, is_active)
select 'AY 2026-2027, 1st Sem', true
where not exists (select 1 from public.exam_terms);

alter table public.exam_registrations add column if not exists term_id uuid references public.exam_terms(id);
update public.exam_registrations
set term_id = (select id from public.exam_terms where is_active limit 1)
where term_id is null;
alter table public.exam_registrations alter column term_id set not null;
create index if not exists exam_registrations_term_id_idx on public.exam_registrations (term_id);

-- Username: unique per semester instead of globally
do $$
declare r record;
begin
  for r in
    select i.indexrelid::regclass as idx, c.conname
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
    left join pg_constraint c on c.conindid = i.indexrelid and c.conrelid = i.indrelid
    where i.indrelid = 'public.exam_registrations'::regclass
      and i.indisunique and not i.indisprimary
      and i.indnatts = 1 and a.attname = 'username'
  loop
    if r.conname is not null then
      execute format('alter table public.exam_registrations drop constraint %I', r.conname);
    else
      execute format('drop index %s', r.idx);
    end if;
  end loop;
end $$;
create unique index if not exists exam_registrations_term_username_key
  on public.exam_registrations (term_id, username);

-- Same name in the same room: unique per semester (only if you had that rule before)
do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'exam_registrations_name_room_key') then
    drop index public.exam_registrations_name_room_key;
    create unique index exam_registrations_name_room_key
      on public.exam_registrations (term_id, upper(trim(full_name)), room_number);
  end if;
end $$;

-- New registrations always land in the ACTIVE semester (the database decides,
-- so an old open page or a direct API call cannot write into an old semester).
create or replace function public.set_registration_term()
returns trigger language plpgsql security definer
set search_path = public as $$
declare t uuid;
begin
  select id into t from public.exam_terms where is_active limit 1;
  if t is null then
    raise exception 'No active semester. Start a semester from the Admin Dashboard.';
  end if;
  new.term_id := t;
  return new;
end;
$$;
drop trigger if exists exam_registrations_set_term on public.exam_registrations;
create trigger exam_registrations_set_term
  before insert on public.exam_registrations
  for each row execute function public.set_registration_term();

create or replace function public.start_new_term(p_label text)
returns uuid language plpgsql security definer
set search_path = public as $$
declare new_id uuid;
begin
  if p_label is null or length(trim(p_label)) = 0 then
    raise exception 'Semester name is required';
  end if;
  update public.exam_terms set is_active = false where is_active;
  insert into public.exam_terms (label, is_active) values (trim(p_label), true) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.set_active_term(p_id uuid)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if not exists (select 1 from public.exam_terms where id = p_id) then
    raise exception 'Semester not found';
  end if;
  update public.exam_terms set is_active = false where is_active and id != p_id;
  update public.exam_terms set is_active = true where id = p_id;
end;
$$;

revoke all on function public.start_new_term(text) from public;
revoke all on function public.set_active_term(uuid) from public;
grant execute on function public.start_new_term(text) to anon, authenticated;
grant execute on function public.set_active_term(uuid) to anon, authenticated;

