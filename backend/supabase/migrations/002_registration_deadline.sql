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

