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

