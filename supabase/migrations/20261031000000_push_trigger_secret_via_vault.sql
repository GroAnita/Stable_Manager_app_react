-- ALTER DATABASE ... SET is not available on hosted Supabase (requires
-- superuser), so app.settings.push_trigger_secret from the previous
-- migration was never actually settable. Use Supabase Vault instead — the
-- secret itself is seeded separately, outside of migrations (never
-- committed to git):
--   select vault.create_secret('...', 'push_trigger_secret', '...');
create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'push_trigger_secret';

  perform net.http_post(
    url := 'https://kutsqjkjnzyfmoidafet.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Secret', coalesce(v_secret, '')
    ),
    body := to_jsonb(NEW)
  );
  return NEW;
end;
$$;
