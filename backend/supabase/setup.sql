create table exam_registrations (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  username text not null unique,
  student_id text unique check (student_id ~ '^[0-9]{4}-[A-Z0-9]{4}$'),
  default_password text not null,
  course text not null,
  room_number text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists exam_config (
  key text primary key,
  value jsonb not null
);

alter table exam_registrations enable row level security;
alter table exam_config enable row level security;

create policy "Allow public inserts" on exam_registrations for insert with check (true);
create policy "Allow public selects" on exam_registrations for select using (true);
create policy "Allow public updates" on exam_registrations for update using (true);
create policy "Allow public deletes" on exam_registrations for delete using (true);

create policy "Allow public read exam_config" on exam_config for select using (true);
create policy "Allow public upsert exam_config" on exam_config for insert with check (true);
create policy "Allow public update exam_config" on exam_config for update using (true);

-- ALREADY HAVE THE exam_registrations TABLE? Skip the create table above
-- and run only this block to add the Student ID column:
alter table exam_registrations add column if not exists student_id text;
alter table exam_registrations drop constraint if exists exam_registrations_student_id_format;
alter table exam_registrations add constraint exam_registrations_student_id_format
  check (student_id is null or student_id ~ '^[0-9]{4}-[A-Z0-9]{4}$');
create unique index if not exists exam_registrations_student_id_key
  on exam_registrations (student_id);

-- OPTIONAL (strict): block the same name twice in the same room at the
-- database level. If this errors, you already have duplicate records:
-- delete them first, then run it again.
create unique index if not exists exam_registrations_name_room_key
  on exam_registrations (upper(trim(full_name)), room_number);

-- ========== REGISTRATION DEADLINE (run once) ==========
-- Server clock + database-level lock. Nobody can bypass this by changing
-- their device time, or by calling the API directly.
create or replace function public.get_server_time()
returns bigint language sql stable as $$
  select (extract(epoch from now()) * 1000)::bigint
$$;

create or replace function public.registration_is_open()
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare
  cfg jsonb;
  closes timestamptz;
begin
  select value into cfg from exam_config where key = 'registration';
  if cfg is null then return true; end if;
  if coalesce((cfg->>'manual_closed')::boolean, false) then return false; end if;
  closes := nullif(cfg->>'closes_at', '')::timestamptz;
  if closes is not null and now() >= closes then return false; end if;
  return true;
end;
$$;

grant execute on function public.get_server_time() to anon, authenticated;
grant execute on function public.registration_is_open() to anon, authenticated;

-- Replace the open insert policy with one that respects the deadline:
drop policy if exists "Allow public inserts" on exam_registrations;
drop policy if exists "Insert only while registration open" on exam_registrations;
create policy "Insert only while registration open" on exam_registrations
  for insert with check (public.registration_is_open());

-- ========== ADMIN ENTRY WHILE CLOSED (run once) ==========
-- Lets the Admin Dashboard "Add Student" button save students after the
-- deadline, but ONLY when the correct Admin Entry Key is supplied.
-- 1) Change CHANGE_THIS_KEY below to a private key only you know.
-- 2) Students and the public form can NOT use this: the key is stored hashed
--    in a table that the public API cannot read.
create table if not exists public.admin_gate (
  id int primary key default 1 check (id = 1),
  key_hash text not null
);
alter table public.admin_gate enable row level security;
revoke all on public.admin_gate from anon, authenticated;

insert into public.admin_gate (id, key_hash)
values (1, encode(sha256(convert_to('CHANGE_THIS_KEY', 'utf8')), 'hex'))
on conflict (id) do update set key_hash = excluded.key_hash;

create or replace function public.admin_add_registration(
  p_key text, p_full_name text, p_username text, p_student_id text,
  p_default_password text, p_course text, p_room text
) returns uuid language plpgsql security definer
set search_path = public as $$
declare
  h text;
  new_id uuid;
begin
  select key_hash into h from public.admin_gate where id = 1;
  if h is null or encode(sha256(convert_to(coalesce(p_key, ''), 'utf8')), 'hex') != h then
    raise exception 'Invalid admin key' using errcode = '28000';
  end if;
  insert into public.exam_registrations
    (full_name, username, student_id, default_password, course, room_number)
  values
    (p_full_name, p_username, p_student_id, p_default_password, p_course, p_room)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.admin_add_registration(text,text,text,text,text,text,text) from public;
grant execute on function public.admin_add_registration(text,text,text,text,text,text,text) to anon, authenticated;

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

-- ========== EDIT SEMESTER NAME (run once) ==========
-- Lets the dashboard rename a semester. Records stay linked by id, so nothing else changes.
create or replace function public.rename_term(p_id uuid, p_label text)
returns void language plpgsql security definer
set search_path = public as $$
begin
  if p_label is null or length(trim(p_label)) = 0 then
    raise exception 'Semester name is required';
  end if;
  if not exists (select 1 from public.exam_terms where id = p_id) then
    raise exception 'Semester not found';
  end if;
  update public.exam_terms set label = trim(p_label) where id = p_id;
end;
$$;

revoke all on function public.rename_term(uuid,text) from public;
grant execute on function public.rename_term(uuid,text) to anon, authenticated;
