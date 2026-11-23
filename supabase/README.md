# Supabase deployment

The audit-division scale editor uses the `ams-api` Edge Function for authenticated writes. Apply the database migration and deploy the function to the same Supabase project used by the app:

```sh
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy ams-api
```

The function reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase Edge Function runtime. Do not put the service-role key in a `VITE_` variable or browser code. The function validates server-issued custom sessions and only permits users whose `system_users.role` is `admin` to manage audit-division scales.

After deployment, users with sessions from the prior client-only login need to sign in again to receive a server-validated session.
