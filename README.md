# Daily Fuel — Private Supabase Edition

Live frontend: https://defranzo.github.io/daily-fuel-tracker/

## Setup
1. Create a Supabase project. Under **Authentication > Users**, add your own email/password account. Disable public signup under Authentication settings.
2. Copy your Auth user UUID and replace `YOUR_AUTH_USER_UUID` in `schema.sql`. Run this file using **SQL Editor**.
3. In **Project Settings / Connect**, copy the Project URL and **publishable key** (or legacy `anon` key) into `supabase-config.js`. NEVER use `service_role` or secret API keys in the browser.
4. Use Live Server locally, sign in, and choose the **private history JSON** (downloaded separately) to import records. Import is idempotent for original history. Test a new meal.
5. After verifying Supabase works, remove `meals.json`, `.github/workflows/add-meal.yml`, and `scripts/add_meal.py` from the GitHub repository. Add `.github/workflows/deploy.yml` (Pages-only deployment). Deploy the frontend files. You may keep `schema.sql` locally rather than pushing it.
6. Review old GitHub Issues and delete any containing meal details; public Git history may still retain old JSON. Consider history rewrite or a fresh repository if minimizing past exposure is important. History rewrite cannot retract downloaded copies.

## Security
- Every query is checked by Supabase Row Level Security; no anonymous data access.
- Supabase publishable/anon key is safe in browser; service_role is not.
- GitHub Pages frontend remains publicly accessible; meal data requires login.
- Do not commit private history JSON, passwords, private keys, or database service secrets.
