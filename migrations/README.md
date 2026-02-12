Apply this migration to add the missing `teachers` columns used by the onboarding form.

Options to run the SQL:

1) Supabase SQL editor (recommended)
- Open your Supabase project → Database → SQL Editor
- Create a new query, paste the contents of `migrations/001_add_teachers_columns.sql`, and run it.

2) supabase CLI (if you have it configured)
- Ensure you're logged in and have project selected, then:

```bash
supabase db query migrations/001_add_teachers_columns.sql
```

3) psql (direct DB access)
- Get the DB connection string from your Supabase project settings. Example fill-in:

```bash
PG_CONN="postgres://<db_user>:<db_password>@<db_host>:5432/postgres"
psql "$PG_CONN" -f migrations/001_add_teachers_columns.sql
```

After applying the migration
- Re-run the test insert locally:

```bash
node scripts/insert-test-teacher.js
```

- Or submit a real form from the UI and check the Supabase table rows.

If you want, I can also generate a second migration to set types differently (e.g., `jsonb` for `subjects`/`exam_focus`) or add indexes—tell me which columns you'd prefer as arrays vs JSON.
