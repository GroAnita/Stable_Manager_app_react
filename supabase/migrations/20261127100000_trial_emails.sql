-- Two emails to stable owners about the free trial, sent by the trial-emails
-- edge function: a welcome email when the stable is created, and a reminder 7
-- days before the trial ends. The app can't say where to subscribe (Apple and
-- Google don't allow it), so the emails do. Each is sent once; the columns
-- below record it.
alter table public.stable_billing
  add column welcome_email_sent_at timestamptz,
  add column trial_reminder_sent_at timestamptz;

-- Stables that exist today don't get a welcome email; the testers were told
-- about their trial in the tester notice. They do get the reminder before
-- their trial ends.
update public.stable_billing set welcome_email_sent_at = now();

create function public.trigger_trial_emails()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'invoice_email_trigger_secret';

  perform net.http_post(
    url := 'https://kutsqjkjnzyfmoidafet.supabase.co/functions/v1/trial-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Invoice-Email-Secret', coalesce(v_secret, '')
    ),
    body := '{"mode":"send"}'::jsonb
  );
end;
$$;

revoke execute on function public.trigger_trial_emails() from public, anon, authenticated;

-- Hourly, so a new stable gets its welcome within the hour.
select cron.schedule(
  'trial-emails',
  '20 * * * *',
  $$select public.trigger_trial_emails();$$
);
