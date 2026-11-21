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

