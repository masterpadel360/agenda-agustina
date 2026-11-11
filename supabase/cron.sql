-- =====================================================================
-- Reloj de los avisos: cada 5 minutos llama a la función "avisos".
-- Correr DESPUÉS de publicar la función (ver LEEME.md, paso 5).
-- Antes de correrlo, reemplazá:
--   TU-PROYECTO  → el código de tu proyecto (lo que va antes de .supabase.co)
--   TU_ANON_KEY  → la clave anon / publishable (la misma de config.js)
-- Las horas las calcula la función en hora de Córdoba (el cron corre en UTC, da igual: es cada 5 min).
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Si ya existía, se reemplaza.
select cron.unschedule(jobid) from cron.job where jobname in ('agustina-avisos', 'agustina-limpieza');

select cron.schedule('agustina-avisos', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/avisos',
    headers := '{"Content-Type":"application/json","apikey":"TU_ANON_KEY","Authorization":"Bearer TU_ANON_KEY"}'::jsonb,
    body := '{"accion":"despachar"}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);

-- Limpieza diaria (04:17 UTC): horarios guardados viejos y avisos de hace más de 4 meses.
select cron.schedule('agustina-limpieza', '17 4 * * *', $$
  delete from public.retenciones where expira < now() - interval '1 day';
  delete from public.notificaciones where creada_at < now() - interval '120 days';
$$);

-- Para ver si anda:  select * from cron.job_run_details order by start_time desc limit 10;
--                    select id, status_code, content from net._http_response order by id desc limit 5;
