-- First enable pg_cron, pg_net and Vault in Supabase.
-- Create mt_closing_url and mt_job_secret in the Vault dashboard before running this file.
select cron.schedule('monkey-town-afsluiten','*/5 * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='mt_closing_url'),
    headers := jsonb_build_object('Content-Type','application/json','x-job-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='mt_job_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
