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
