# Backend (Supabase)

The backend is the Supabase project: Postgres tables, row-level-security policies and SQL functions.
The browser talks to it through the Supabase JS client (`frontend/js/09-supabase-client.js`).

## Files
`supabase/migrations/` holds the changes in the order they were introduced:

| File | Adds |
|---|---|
| 001_base_schema.sql | `exam_registrations`, `exam_config`, RLS policies, Student ID format, name+room rule |
| 002_registration_deadline.sql | `get_server_time()`, `registration_is_open()`, database-level lock on registration |
| 003_admin_entry_while_closed.sql | `admin_add_registration(...)` so the admin can add students while registration is closed |
| 004_semester_terms.sql | `exam_terms`, `term_id` on registrations, `start_new_term()`, `set_active_term()` |
| 005_edit_semester_name.sql | `rename_term()` used by the Edit button |

`supabase/setup.sql` is all of them joined, for a brand-new project.

## Already running in production?
Do nothing for 001–004. Only run files you have not run yet (for example 005).

Re-running is **not** always safe:
- `001` creates tables and policies with no "if not exists" guard. Never re-run it on a database that has data.
- `003` resets the admin entry key back to the placeholder `CHANGE_THIS_KEY`. Only re-run it if you want that reset.
- `002`, `004` and `005` are written to be safe to re-run.

## Adding a change
1. Create `backend/supabase/migrations/006_short_name.sql` (next number).
2. Run it once in the Supabase SQL Editor.
3. Run `node scripts/build-sql.js` so `setup.sql` and the in-app SQL box include it.
4. If the frontend calls it, use `supabaseClient.rpc('function_name', {...})` in the matching file under `frontend/js/`.
