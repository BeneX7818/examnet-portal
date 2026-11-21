# ExamNet Student Registration Portal

Static web app (GitHub Pages) + Supabase (database + functions). No build step: push the folder and it runs.

```
examnet-portal/
├─ index.html                 Page markup + modals. Stays at the root so the live URL does not change.
├─ frontend/
│  ├─ css/styles.css          Custom styles (Tailwind itself still comes from the CDN)
│  └─ js/01-…22-*.js          App code, split by feature. Plain scripts, NOT modules (see below)
├─ backend/
│  ├─ README.md               What lives in Supabase and how to apply changes
│  └─ supabase/
│     ├─ migrations/*.sql     The database: tables, policies, functions (source of truth)
│     └─ setup.sql            All migrations joined (generated)
└─ scripts/build-sql.js       Keeps the in-app "Copy SQL" box equal to the migrations
```

## Frontend rules (important)
- **Load order matters.** `index.html` lists the scripts in order (01 → 22). The files share one global scope,
  exactly like the old single `<script>`, so the `onclick="..."` handlers in the HTML keep working.
  A new file goes into `index.html` in the right position, and the number prefix shows the order.
- Don't convert these to `import`/`export` modules without also removing every inline `onclick`.

| File | What it does |
|---|---|
| 01-state, 03-config | Shared variables, default courses/rooms, constants |
| 02-semesters | Semester list, start new semester, edit (rename), make active |
| 04-init, 08-router | Startup and `#dashboard` / student form routing |
| 05-security | Admin password handling |
| 06-rooms-courses | Rooms & Courses management |
| 07-registration-deadline | Server-clock deadline and open/closed state |
| 09-supabase-client | Supabase connection + settings (falls back to LocalStorage) |
| 10–15 | Student form: username, student ID, name field, duplicate check, submit |
| 16-admin-add-student | Admin "Add Student" |
| 12, 17, 18 | Loading, editing and listing registrations |
| 19-excel-export | Excel export |
| 20-reset-data | Reset data (with backup) |
| 21-account-image, 22-helpers | Account image download, shared helpers |

## Backend changes
See `backend/README.md`. After adding or editing a migration, run `node scripts/build-sql.js`.
