-- =====================================================================
-- Agenda de la Lic. Agustina Arrieta — Base de datos (Supabase / Postgres 15+)
-- Pegar entero en Supabase → SQL Editor → Run. Se puede volver a correr.
--
-- Idea central:
--   * Todo lo privado (pacientes, turnos, notas, Mi vida, avisos) lo lee y
--     escribe SOLO la dueña (Agustina). Se define con la tabla `duena`.
--   * Los pacientes no tienen cuenta: no tocan las tablas. Usan funciones
--     (RPC) que validan todo y solo devuelven lo mínimo:
--       - horarios y ocupados SIN nombres (solo inicio y fin),
--       - su propio turno, con el link secreto (token).
--   * Las reglas (grilla de horarios, edad, 24 h) son las mismas de js/logica.js.
-- Zona horaria: America/Argentina/Cordoba (UTC-3 todo el año).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
-- Quién es la dueña. Se carga UNA vez a mano (ver LEEME.md). Sin políticas: nadie la toca desde la app.
create table if not exists public.duena (
  id      int primary key default 1 check (id = 1),
  usuario uuid references auth.users (id) on delete set null
);
insert into public.duena (id) values (1) on conflict (id) do nothing;

create table if not exists public.ajustes (
  id                   int primary key default 1 check (id = 1),
  nombre_publico       text not null default 'Lic. Agustina Arrieta' check (length(nombre_publico) <= 80),
  profesion            text not null default 'Psicóloga' check (length(profesion) <= 60),
  lema                 text not null default 'Salud mental también es conocimiento' check (length(lema) <= 120),
  sena_monto           int  not null default 10000 check (sena_monto between 0 and 10000000),
  alias                text not null default 'Licagustina.mp' check (length(alias) <= 60),
  matricula            text not null default 'Mat. 11933' check (length(matricula) <= 40),
  titular              text not null default 'Agustina Arrieta' check (length(titular) <= 80),
  whatsapp             text not null default '' check (length(whatsapp) <= 30),
  link_videollamada    text not null default '' check (length(link_videollamada) <= 300),
  horas_cambio         int  not null default 24 check (horas_cambio between 0 and 168),
  anticipacion_horas   int  not null default 12 check (anticipacion_horas between 0 and 168),
  horizonte_dias       int  not null default 30 check (horizonte_dias between 1 and 120),
  retencion_min        int  not null default 10 check (retencion_min between 3 and 30),
  recordatorio_horas   int[] not null default '{24}' check (array_length(recordatorio_horas, 1) is null or array_length(recordatorio_horas, 1) <= 4),
  recordatorio_texto   text not null default 'Hola {nombre}! Te recuerdo tu sesión {dia} a las {hora} ({modalidad}). {link_videollamada}
Si no podés asistir, avisame con al menos 24 horas de anticipación. De lo contrario, la sesión se abona igualmente.
Gracias por comprender y valorar este espacio.' check (length(recordatorio_texto) <= 1000),
  recordatorio_imagen  text check (length(recordatorio_imagen) <= 200),   -- plantilla propia en el bucket "imagenes" (null = la que viene con la app)
  recordatorio_img     jsonb not null default '{"dia_y":0.4565,"hora_y":0.5474,"x1":0.262,"x2":0.8957,"tam":0.036,"color":"#3E463B"}',  -- dónde se escriben día y hora (fracciones de la imagen)
  recordatorio_canal   text not null default 'whatsapp_manual' check (recordatorio_canal in ('whatsapp_manual', 'whatsapp_api')),
  resumen_hora         text not null default '08:00' check (resumen_hora ~ '^\d{2}:\d{2}$'),
  pendientes_hora      text not null default '20:00' check (pendientes_hora ~ '^\d{2}:\d{2}$'),
  avisos               jsonb not null default '{"reserva":true,"cambio":true,"comprobante":true,"recordatorios":true,"vida":true,"resumen":true,"pendientes":true}',
  actualizado_at       timestamptz not null default now()
);
insert into public.ajustes (id) values (1) on conflict (id) do nothing;

-- Presencial y virtual: cada una con su horario semanal y su duración.
-- horario: {"1":[["09:00","13:00"],["15:00","19:00"]], "3":[...]}  (1 = lunes … 7 = domingo)
create table if not exists public.modalidades (
  id        text primary key check (id in ('presencial', 'virtual')),
  activa    boolean not null default true,
  duracion  int  not null default 50 check (duracion between 15 and 240),
  descanso  int  not null default 10 check (descanso between 0 and 120),
  horario   jsonb not null default '{}',
  detalle   text not null default '' check (length(detalle) <= 120),  -- "Consultorio en Nueva Córdoba"
  orden     int  not null default 0
);
insert into public.modalidades (id, activa, duracion, descanso, horario, detalle, orden) values
  ('presencial', true, 50, 10, '{"1":[["09:00","13:00"],["15:00","19:00"]],"3":[["09:00","13:00"],["15:00","19:00"]],"5":[["09:00","13:00"]]}', 'Consultorio', 1),
  ('virtual',    true, 50, 10, '{"2":[["17:00","21:00"]],"3":[["19:00","21:00"]],"4":[["17:00","21:00"]]}', 'Videollamada desde donde estés', 2)
on conflict (id) do nothing;

create table if not exists public.servicios (
  id      bigint generated always as identity primary key,
  nombre  text not null check (length(nombre) between 2 and 80),
  detalle text not null default '' check (length(detalle) <= 160),
  precio  int  not null default 0 check (precio between 0 and 100000000),
  activo  boolean not null default true,
  orden   int  not null default 0
);
insert into public.servicios (nombre, detalle, precio, orden)
select 'Psicoterapia individual', 'Adolescentes, jóvenes y adultos · desde 15 años', 30000, 1
where not exists (select 1 from public.servicios);

-- Días bloqueados (vacaciones, feriados). modalidad null = las dos.
create table if not exists public.bloqueos (
  id        bigint generated always as identity primary key,
  desde     date not null,
  hasta     date not null,
  motivo    text not null default '' check (length(motivo) <= 80),
  modalidad text check (modalidad in ('presencial', 'virtual')),
  check (hasta >= desde)
);

create table if not exists public.pacientes (
  id                   bigint generated always as identity primary key,
  nombre               text not null check (length(nombre) between 2 and 80),
  telefono             text not null default '' check (length(telefono) <= 30),
  email                text not null default '' check (length(email) <= 120),
  nacimiento           date,
  responsable_nombre   text not null default '' check (length(responsable_nombre) <= 80),
  responsable_telefono text not null default '' check (length(responsable_telefono) <= 30),
  notas                text not null default '' check (length(notas) <= 20000),
  motivo               text not null default '' check (length(motivo) <= 600),
  creado_at            timestamptz not null default now()
);
create index if not exists pacientes_tel on public.pacientes (regexp_replace(telefono, '\D', '', 'g'));

create table if not exists public.turnos (
  id           bigint generated always as identity primary key,
  token        text not null unique,                    -- link secreto "mi turno"
  paciente_id  bigint not null references public.pacientes (id) on delete cascade,
  servicio_id  bigint references public.servicios (id) on delete set null,
  modalidad    text not null check (modalidad in ('presencial', 'virtual')),
  inicio       timestamptz not null,
  fin          timestamptz not null,
  estado       text not null default 'reservado' check (estado in ('reservado', 'cancelado')),
  sena         text not null default 'pendiente' check (sena in ('pendiente', 'por_revisar', 'confirmada')),
  comprobante  text,                                    -- ruta en el bucket "comprobantes"
  comprobante_at timestamptz,
  primera_vez  boolean,
  motivo       text not null default '' check (length(motivo) <= 600),
  origen       text not null default 'paciente' check (origen in ('paciente', 'agustina')),
  cambios      int  not null default 0,
  creado_at    timestamptz not null default now(),
  agendado_at  timestamptz not null default now(),    -- última vez que se fijó el horario
  check (fin > inicio),
  -- Una sola persona por horario: dos turnos activos nunca se pisan (presencial o virtual: es la misma Agustina).
  constraint turnos_sin_superposicion exclude using gist (tstzrange(inicio, fin, '[)') with &&) where (estado = 'reservado')
);
create index if not exists turnos_inicio on public.turnos (inicio);

create table if not exists public.historial (
  id        bigint generated always as identity primary key,
  turno_id  bigint not null references public.turnos (id) on delete cascade,
  at        timestamptz not null default now(),
  tipo      text not null,      -- reserva, cambio, comprobante, sena, cancelado, creado, movido
  detalle   text not null default ''
);

-- Horario "guardado" mientras el paciente completa la reserva (unos minutos).
create table if not exists public.retenciones (
  token     text primary key,
  modalidad text not null,
  inicio    timestamptz not null,
  fin       timestamptz not null,
  expira    timestamptz not null,
  creado_at timestamptz not null default now()
);

-- Mi vida: eventos y cosas para hacer. Privado.
create table if not exists public.eventos (
  id          bigint generated always as identity primary key,
  tipo        text not null default 'evento' check (tipo in ('evento', 'tarea')),
  titulo      text not null check (length(titulo) between 1 and 120),
  fecha       date,
  hora_inicio time,
  hora_fin    time,
  repetir     text not null default 'no' check (repetir in ('no', 'semanal')),
  aviso_min   int check (aviso_min in (0, 15, 30, 60, 1440)),
  bloquea     boolean not null default false,       -- "Bloquear este horario para pacientes"
  hecho       boolean not null default false,
  color       text not null default '#8A4BF2' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  creado_at   timestamptz not null default now()
);

-- Campanita + cola de avisos push. clave = para no mandar dos veces lo mismo.
create table if not exists public.notificaciones (
  id        bigint generated always as identity primary key,
  tipo      text not null,      -- reserva, cambio, comprobante, recordatorio, vida, resumen, pendientes, prueba
  titulo    text not null,
  cuerpo    text not null default '',
  url       text not null default '',
  clave     text unique,
  turno_id  bigint references public.turnos (id) on delete cascade,
  creada_at timestamptz not null default now(),
  leida     boolean not null default false,
  push      text not null default 'pendiente' check (push in ('pendiente', 'enviado', 'omitido', 'error')),
  push_at   timestamptz
);
create index if not exists notificaciones_push on public.notificaciones (push, creada_at);

-- Recordatorios a pacientes (X horas antes). Hoy: Agustina los manda por WhatsApp con un toque.
-- canal 'whatsapp_api' queda preparado para un envío automático futuro (ver LEEME.md).
create table if not exists public.recordatorios (
  id         bigint generated always as identity primary key,
  turno_id   bigint not null references public.turnos (id) on delete cascade,
  horas      int  not null,
  para       timestamptz not null,       -- inicio de la sesión cuando se generó
  creado_at  timestamptz not null default now(),
  estado     text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'descartado', 'error')),
  canal      text not null default 'whatsapp_manual',
  enviado_at timestamptz,
  detalle    text not null default '',
  unique (turno_id, horas, para)
);

-- Celulares donde Agustina activó los avisos.
create table if not exists public.suscripciones (
  id        bigint generated always as identity primary key,
  endpoint  text not null unique check (endpoint ~ '^https://'),
  p256dh    text not null,
  auth      text not null,
  equipo    text not null default '' check (length(equipo) <= 120),
  creado_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Ayudas
-- ---------------------------------------------------------------------
create or replace function public.es_duena()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and auth.uid() = (select usuario from public.duena where id = 1);
$$;

create or replace function public.ms(t timestamptz)
returns bigint language sql immutable as $$ select (extract(epoch from t) * 1000)::bigint $$;

create or replace function public.de_ms(m bigint)
returns timestamptz language sql immutable as $$ select to_timestamp(m / 1000.0) $$;

create or replace function public.nuevo_token()
returns text language sql volatile as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

create or replace function public.hoy_cba()
returns date language sql stable as $$ select (now() at time zone 'America/Argentina/Cordoba')::date $$;

create or replace function public.minutos_de(h text)
returns int language sql immutable as $$ select split_part(h, ':', 1)::int * 60 + split_part(h, ':', 2)::int $$;

-- Tramos de Mi vida que bloquean pacientes (eventos con "bloquear" activado), entre dos días.
create or replace function public.ocurrencias_bloqueo(p_desde date, p_hasta date)
returns table (inicio timestamptz, fin timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    (x.d + coalesce(e.hora_inicio, '00:00'::time)) at time zone 'America/Argentina/Cordoba',
    case
      when e.hora_inicio is null then (x.d + 1)::timestamp at time zone 'America/Argentina/Cordoba'
      when e.hora_fin is null or e.hora_fin <= e.hora_inicio then (x.d + e.hora_inicio + interval '1 hour') at time zone 'America/Argentina/Cordoba'
      else (x.d + e.hora_fin) at time zone 'America/Argentina/Cordoba'
    end
  from public.eventos e
  cross join lateral (select g::date as d from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') g) x
  where e.bloquea and e.tipo = 'evento' and e.fecha is not null
    and ((e.repetir = 'no' and e.fecha = x.d)
      or (e.repetir = 'semanal' and e.fecha <= x.d and extract(isodow from e.fecha) = extract(isodow from x.d)));
$$;

-- ¿Se pisa con algo? (turnos activos, horarios guardados vigentes de otros, Mi vida que bloquea)
create or replace function public.hay_choque(p_ini timestamptz, p_fin timestamptz, p_excluir_turno bigint, p_excluir_ret text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.turnos t where t.estado = 'reservado' and t.id is distinct from p_excluir_turno and t.inicio < p_fin and p_ini < t.fin)
      or exists (select 1 from public.retenciones r where r.expira > now() and r.token is distinct from p_excluir_ret and r.inicio < p_fin and p_ini < r.fin)
      or exists (select 1 from public.ocurrencias_bloqueo(((p_ini at time zone 'America/Argentina/Cordoba')::date - 1), (p_fin at time zone 'America/Argentina/Cordoba')::date) o
                 where o.inicio < p_fin and p_ini < o.fin);
$$;

-- ¿Este inicio es un turno de la grilla de esa modalidad? (misma cuenta que esSlotValido de js/logica.js)
create or replace function public.slot_valido(p_mod text, p_ini timestamptz)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  m public.modalidades; a public.ajustes; loc timestamp; d date; tm int; r jsonb; am int; bm int; paso int;
begin
  select * into m from public.modalidades where id = p_mod;
  if not found or not m.activa then return false; end if;
  select * into a from public.ajustes where id = 1;
  if p_ini < now() + make_interval(hours => a.anticipacion_horas) then return false; end if;
  loc := p_ini at time zone 'America/Argentina/Cordoba';
  d := loc::date;
  if d > public.hoy_cba() + a.horizonte_dias then return false; end if;
  if extract(second from loc) <> 0 then return false; end if;
  if exists (select 1 from public.bloqueos b where d between b.desde and b.hasta and (b.modalidad is null or b.modalidad = p_mod)) then return false; end if;
  tm := extract(hour from loc)::int * 60 + extract(minute from loc)::int;
  paso := m.duracion + m.descanso;
  for r in select value from jsonb_array_elements(coalesce(m.horario -> (extract(isodow from d)::int)::text, '[]'::jsonb)) loop
    am := public.minutos_de(r ->> 0);
    bm := public.minutos_de(r ->> 1);
    if tm >= am and tm + m.duracion <= bm and (tm - am) % paso = 0 then return true; end if;
  end loop;
  return false;
end $$;

create or replace function public.avisar(p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_turno bigint)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.notificaciones (tipo, titulo, cuerpo, url, turno_id) values (p_tipo, left(p_titulo, 120), left(p_cuerpo, 300), p_url, p_turno);
$$;

-- "hoy 18:00 · presencial" (mismo texto que avisoInstante de js/logica.js)
create or replace function public.texto_cuando(p_ini timestamptz, p_mod text)
returns text language sql stable as $$
  select case
           when (p_ini at time zone 'America/Argentina/Cordoba')::date = public.hoy_cba() then 'hoy'
           when (p_ini at time zone 'America/Argentina/Cordoba')::date = public.hoy_cba() + 1 then 'mañana'
           else 'el ' || (array['lunes','martes','miércoles','jueves','viernes','sábado','domingo'])[extract(isodow from (p_ini at time zone 'America/Argentina/Cordoba'))::int]
                || ' ' || extract(day from (p_ini at time zone 'America/Argentina/Cordoba'))::int
         end
         || ' ' || to_char(p_ini at time zone 'America/Argentina/Cordoba', 'HH24:MI')
         || ' · ' || p_mod;
$$;

create or replace function public.primer_nombre(n text)
returns text language sql immutable as $$ select split_part(btrim(coalesce(n, '')), ' ', 1) $$;

-- ---------------------------------------------------------------------
-- 3. Lo que usa la página de reservas (sin cuenta). Solo lo mínimo.
-- ---------------------------------------------------------------------
create or replace function public.publico_info()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'nombre', a.nombre_publico, 'profesion', a.profesion, 'lema', a.lema, 'matricula', a.matricula,
    'sena', a.sena_monto, 'alias', a.alias, 'titular', a.titular, 'whatsapp', a.whatsapp,
    'horas_cambio', a.horas_cambio, 'anticipacion_horas', a.anticipacion_horas, 'horizonte_dias', a.horizonte_dias, 'retencion_min', a.retencion_min,
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'detalle', s.detalle, 'precio', s.precio) order by s.orden, s.id)
                           from public.servicios s where s.activo), '[]'::jsonb),
    'modalidades', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'activa', m.activa, 'duracion', m.duracion, 'descanso', m.descanso, 'horario', m.horario, 'detalle', m.detalle) order by m.orden)
                             from public.modalidades m), '[]'::jsonb),
    -- sin el motivo: eso es privado
    'bloqueos', coalesce((select jsonb_agg(jsonb_build_object('desde', b.desde, 'hasta', b.hasta, 'modalidad', b.modalidad))
                          from public.bloqueos b where b.hasta >= public.hoy_cba()), '[]'::jsonb),
    'ahora', public.ms(now()))
  from public.ajustes a where a.id = 1;
$$;

-- Tramos ocupados entre dos días: solo inicio y fin (ms). Nunca quién.
create or replace function public.publico_ocupado(p_desde date, p_hasta date, p_retencion text default null)
returns table (inicio bigint, fin bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare a timestamptz; b timestamptz;
begin
  if p_hasta < p_desde or p_hasta - p_desde > 62 then raise exception 'Rango inválido.'; end if;
  a := p_desde::timestamp at time zone 'America/Argentina/Cordoba';
  b := (p_hasta + 1)::timestamp at time zone 'America/Argentina/Cordoba';
  return query
    select public.ms(t.inicio), public.ms(t.fin) from public.turnos t where t.estado = 'reservado' and t.inicio < b and a < t.fin
    union all
    select public.ms(r.inicio), public.ms(r.fin) from public.retenciones r where r.expira > now() and r.token is distinct from p_retencion and r.inicio < b and a < r.fin
    union all
    select public.ms(o.inicio), public.ms(o.fin) from public.ocurrencias_bloqueo(p_desde, p_hasta) o;
end $$;

-- Guarda un horario unos minutos mientras el paciente completa la reserva.
-- Si manda su token anterior, se reemplaza (y su propio horario no le bloquea).
create or replace function public.retener(p_mod text, p_inicio bigint, p_token text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare ini timestamptz; m public.modalidades; a public.ajustes; tk text; exp timestamptz;
begin
  perform pg_advisory_xact_lock(20261110);
  select * into m from public.modalidades where id = p_mod;
  select * into a from public.ajustes where id = 1;
  ini := public.de_ms(p_inicio);
  if m.id is null or not public.slot_valido(p_mod, ini) then raise exception 'Ese horario ya no está disponible. Elegí otro.'; end if;
  delete from public.retenciones where expira < now() - interval '1 hour';
  tk := case when p_token ~ '^[A-Za-z0-9_-]{16,80}$' then p_token else public.nuevo_token() end;
  delete from public.retenciones where token = tk;
  if public.hay_choque(ini, ini + make_interval(mins => m.duracion), null, tk) then raise exception 'Ese horario se acaba de ocupar. Elegí otro.'; end if;
  if (select count(*) from public.retenciones where expira > now()) >= 60 then raise exception 'Hay mucha gente reservando. Probá en un ratito.'; end if;
  exp := now() + make_interval(mins => a.retencion_min);
  insert into public.retenciones (token, modalidad, inicio, fin, expira) values (tk, p_mod, ini, ini + make_interval(mins => m.duracion), exp);
  return jsonb_build_object('token', tk, 'expira', public.ms(exp));
end $$;

-- Libera el horario guardado (al volver atrás o al cerrar la página).
create or replace function public.soltar(p_token text)
returns void language sql security definer set search_path = public, pg_temp as $$
  delete from public.retenciones where token = p_token;
$$;

-- Reserva: valida datos y edad, que el horario siga libre, crea paciente y turno.
create or replace function public.reservar(p_retencion text, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.retenciones; a public.ajustes; nac date; ed int; tel text; pid bigint; sid bigint; t public.turnos; nom text;
begin
  perform pg_advisory_xact_lock(20261110);
  select * into a from public.ajustes where id = 1;
  select * into r from public.retenciones where token = p_retencion;
  if not found then raise exception 'Se venció el tiempo para reservar. Elegí el horario de nuevo.'; end if;

  nom := btrim(coalesce(p_datos ->> 'nombre', ''));
  tel := regexp_replace(coalesce(p_datos ->> 'telefono', ''), '\D', '', 'g');
  if length(nom) < 3 or length(nom) > 80 then raise exception 'Escribí tu nombre y apellido.'; end if;
  if length(tel) < 8 or length(tel) > 15 then raise exception 'Revisá tu WhatsApp: tiene que tener código de área.'; end if;
  if coalesce(p_datos ->> 'email', '') <> '' and (p_datos ->> 'email') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Revisá tu mail (o dejalo vacío).'; end if;
  begin nac := (p_datos ->> 'nacimiento')::date; exception when others then nac := null; end;
  if nac is null then raise exception 'Revisá tu fecha de nacimiento.'; end if;
  ed := extract(year from age(public.hoy_cba(), nac))::int;
  if ed < 0 or ed > 110 then raise exception 'Revisá tu fecha de nacimiento.'; end if;
  if ed < 15 then raise exception 'La atención es desde los 15 años.'; end if;
  if ed < 18 and (length(btrim(coalesce(p_datos ->> 'responsable_nombre', ''))) < 3
                  or length(regexp_replace(coalesce(p_datos ->> 'responsable_telefono', ''), '\D', '', 'g')) < 8) then
    raise exception 'Sumá el nombre y teléfono del adulto responsable.';
  end if;
  if jsonb_typeof(p_datos -> 'primera_vez') <> 'boolean' then raise exception 'Contanos si es tu primera vez.'; end if;
  if length(coalesce(p_datos ->> 'motivo', '')) > 600 then raise exception 'El motivo es muy largo (hasta 600 letras).'; end if;

  sid := nullif(p_datos ->> 'servicio_id', '')::bigint;
  if sid is null or not exists (select 1 from public.servicios where id = sid and activo) then
    select id into sid from public.servicios where activo order by orden, id limit 1;
  end if;

  if not public.slot_valido(r.modalidad, r.inicio) or public.hay_choque(r.inicio, r.fin, null, r.token) then
    raise exception 'Ese horario se acaba de ocupar. Elegí otro.';
  end if;
  -- Frenos anti-abuso
  if (select count(*) from public.turnos where origen = 'paciente' and creado_at > now() - interval '1 hour') >= 30 then
    raise exception 'Hay muchas reservas seguidas. Probá en un ratito.';
  end if;

  select id into pid from public.pacientes where regexp_replace(telefono, '\D', '', 'g') = tel order by id limit 1;
  if pid is null then
    insert into public.pacientes (nombre, telefono, email, nacimiento, responsable_nombre, responsable_telefono, motivo)
    values (nom, left(p_datos ->> 'telefono', 30), left(coalesce(p_datos ->> 'email', ''), 120), nac,
            left(coalesce(p_datos ->> 'responsable_nombre', ''), 80), left(coalesce(p_datos ->> 'responsable_telefono', ''), 30),
            left(coalesce(p_datos ->> 'motivo', ''), 600))
    returning id into pid;
  else
    -- Paciente conocido: solo completa lo que falta (nunca pisa lo que cargó Agustina).
    update public.pacientes set
      email = case when email = '' then left(coalesce(p_datos ->> 'email', ''), 120) else email end,
      nacimiento = coalesce(nacimiento, nac),
      responsable_nombre = case when responsable_nombre = '' then left(coalesce(p_datos ->> 'responsable_nombre', ''), 80) else responsable_nombre end,
      responsable_telefono = case when responsable_telefono = '' then left(coalesce(p_datos ->> 'responsable_telefono', ''), 30) else responsable_telefono end
    where id = pid;
    if (select count(*) from public.turnos where paciente_id = pid and estado = 'reservado' and inicio > now() and origen = 'paciente') >= 3 then
      raise exception 'Ya tenés turnos reservados. Para sumar otro, escribile a Agustina.';
    end if;
  end if;

  insert into public.turnos (token, paciente_id, servicio_id, modalidad, inicio, fin, primera_vez, motivo, origen)
  values (public.nuevo_token(), pid, sid, r.modalidad, r.inicio, r.fin, (p_datos ->> 'primera_vez')::boolean, left(coalesce(p_datos ->> 'motivo', ''), 600), 'paciente')
  returning * into t;
  delete from public.retenciones where token = r.token;
  insert into public.historial (turno_id, tipo, detalle) values (t.id, 'reserva', 'Reservó desde la página');
  perform public.avisar('reserva', 'Nueva reserva: ' || nom, public.texto_cuando(t.inicio, t.modalidad), '#turno/' || t.id, t.id);
  return jsonb_build_object('token', t.token, 'inicio', public.ms(t.inicio), 'fin', public.ms(t.fin));
end $$;

-- "Mi turno": lo que ve el paciente con su link secreto.
create or replace function public.mi_turno(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t public.turnos; a public.ajustes; p public.pacientes; s public.servicios; m public.modalidades;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{16,80}$' then raise exception 'No encontramos ese turno.'; end if;
  select * into t from public.turnos where token = p_token;
  if not found then raise exception 'No encontramos ese turno.'; end if;
  select * into a from public.ajustes where id = 1;
  select * into p from public.pacientes where id = t.paciente_id;
  select * into s from public.servicios where id = t.servicio_id;
  select * into m from public.modalidades where id = t.modalidad;
  return jsonb_build_object(
    'inicio', public.ms(t.inicio), 'fin', public.ms(t.fin), 'modalidad', t.modalidad, 'estado', t.estado, 'sena', t.sena,
    'comprobante', t.comprobante is not null, 'nombre', public.primer_nombre(p.nombre),
    'servicio', coalesce(s.nombre, 'Sesión'), 'detalle', coalesce(m.detalle, ''),
    'link_videollamada', case when t.modalidad = 'virtual' and t.estado = 'reservado' then a.link_videollamada else '' end,
    'horas_cambio', a.horas_cambio, 'limite_cambio', public.ms(t.inicio - make_interval(hours => a.horas_cambio)),
    'puede_cambiar', t.estado = 'reservado' and now() < t.inicio - make_interval(hours => a.horas_cambio),
    'whatsapp', a.whatsapp, 'alias', a.alias, 'titular', a.titular, 'sena_monto', a.sena_monto, 'ahora', public.ms(now()));
end $$;

-- Cambiar el turno: SOLO si faltan más de X horas (24 por defecto). Lo frena la base, no la pantalla.
create or replace function public.cambiar_turno(p_token text, p_retencion text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.turnos; a public.ajustes; r public.retenciones; nom text; antes timestamptz;
begin
  perform pg_advisory_xact_lock(20261110);
  select * into a from public.ajustes where id = 1;
  select * into t from public.turnos where token = p_token for update;
  if not found or p_token !~ '^[A-Za-z0-9_-]{16,80}$' then raise exception 'No encontramos ese turno.'; end if;
  if t.estado <> 'reservado' then raise exception 'Este turno está cancelado. Escribile a Agustina.'; end if;
  if now() >= t.inicio - make_interval(hours => a.horas_cambio) then
    raise exception 'Faltan menos de % h: ya no se puede cambiar. Escribile a Agustina.', a.horas_cambio;
  end if;
  if t.cambios >= 3 then raise exception 'Ya cambiaste este turno varias veces. Escribile a Agustina.'; end if;
  select * into r from public.retenciones where token = p_retencion;
  if not found then raise exception 'Se venció el tiempo. Elegí el horario de nuevo.'; end if;
  if r.modalidad <> t.modalidad then raise exception 'El cambio tiene que ser en la misma modalidad.'; end if;
  if not public.slot_valido(r.modalidad, r.inicio) or public.hay_choque(r.inicio, r.fin, t.id, r.token) then
    raise exception 'Ese horario se acaba de ocupar. Elegí otro.';
  end if;
  antes := t.inicio;
  update public.turnos set inicio = r.inicio, fin = r.fin, agendado_at = now(), cambios = cambios + 1 where id = t.id returning * into t;
  delete from public.retenciones where token = r.token;
  select nombre into nom from public.pacientes where id = t.paciente_id;
  insert into public.historial (turno_id, tipo, detalle) values (t.id, 'cambio', 'Lo cambió el paciente. Antes: ' || to_char(antes at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI'));
  perform public.avisar('cambio', nom || ' cambió su turno', 'Ahora: ' || public.texto_cuando(t.inicio, t.modalidad), '#turno/' || t.id, t.id);
  return jsonb_build_object('inicio', public.ms(t.inicio), 'fin', public.ms(t.fin));
end $$;

-- Después de subir la foto con la URL firmada (función "avisos"), se registra acá.
create or replace function public.registrar_comprobante(p_token text, p_path text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.turnos; nom text;
begin
  select * into t from public.turnos where token = p_token for update;
  if not found or p_token !~ '^[A-Za-z0-9_-]{16,80}$' then raise exception 'No encontramos ese turno.'; end if;
  if t.estado <> 'reservado' then raise exception 'Este turno está cancelado.'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> t.id::text or p_path !~ '^[0-9]+/[A-Za-z0-9_-]+\.(jpg|png|webp|heic|pdf)$' then raise exception 'Comprobante inválido.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'comprobantes' and name = p_path) then raise exception 'No llegó la foto. Probá de nuevo.'; end if;
  update public.turnos set comprobante = p_path, comprobante_at = now(), sena = case when sena = 'confirmada' then sena else 'por_revisar' end where id = t.id;
  select nombre into nom from public.pacientes where id = t.paciente_id;
  insert into public.historial (turno_id, tipo, detalle) values (t.id, 'comprobante', 'Subió el comprobante');
  perform public.avisar('comprobante', nom || ' subió el comprobante', 'Revisá la seña · ' || public.texto_cuando(t.inicio, t.modalidad), '#turno/' || t.id, t.id);
end $$;

-- ---------------------------------------------------------------------
-- 4. Acciones de Agustina sobre turnos (dejan historial). Todas chequean es_duena().
-- ---------------------------------------------------------------------
create or replace function public.duena_crear_turno(p_paciente bigint, p_servicio bigint, p_mod text, p_inicio bigint, p_duracion int default null, p_sena text default 'pendiente')
returns public.turnos language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.turnos; m public.modalidades; ini timestamptz;
begin
  if not public.es_duena() then raise exception 'Solo Agustina.'; end if;
  select * into m from public.modalidades where id = p_mod;
  if not found then raise exception 'Modalidad inválida.'; end if;
  ini := public.de_ms(p_inicio);
  insert into public.turnos (token, paciente_id, servicio_id, modalidad, inicio, fin, origen, sena, primera_vez)
  values (public.nuevo_token(), p_paciente, p_servicio, p_mod, ini, ini + make_interval(mins => coalesce(p_duracion, m.duracion)), 'agustina',
          case when p_sena in ('pendiente', 'por_revisar', 'confirmada') then p_sena else 'pendiente' end,
          not exists (select 1 from public.turnos where paciente_id = p_paciente))
  returning * into t;
  insert into public.historial (turno_id, tipo, detalle) values (t.id, 'creado', 'Lo cargaste vos');
  return t;
exception when exclusion_violation then raise exception 'Ese horario ya tiene otro turno.';
end $$;

create or replace function public.duena_mover_turno(p_id bigint, p_inicio bigint, p_mod text default null)
returns public.turnos language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.turnos; antes timestamptz; dur interval; m text;
begin
  if not public.es_duena() then raise exception 'Solo Agustina.'; end if;
  select * into t from public.turnos where id = p_id for update;
  if not found then raise exception 'No existe ese turno.'; end if;
  antes := t.inicio; dur := t.fin - t.inicio; m := coalesce(p_mod, t.modalidad);
  update public.turnos set inicio = public.de_ms(p_inicio), fin = public.de_ms(p_inicio) + dur, modalidad = m, estado = 'reservado', agendado_at = now()
  where id = p_id returning * into t;
  insert into public.historial (turno_id, tipo, detalle) values (t.id, 'movido', 'Lo moviste vos. Antes: ' || to_char(antes at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI'));
  return t;
exception when exclusion_violation then raise exception 'Ese horario ya tiene otro turno.';
end $$;

create or replace function public.duena_cancelar_turno(p_id bigint, p_motivo text default '')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.es_duena() then raise exception 'Solo Agustina.'; end if;
  update public.turnos set estado = 'cancelado' where id = p_id;
  insert into public.historial (turno_id, tipo, detalle) values (p_id, 'cancelado', left(coalesce(nullif(p_motivo, ''), 'Lo cancelaste vos'), 200));
end $$;

create or replace function public.duena_sena(p_id bigint, p_estado text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.es_duena() then raise exception 'Solo Agustina.'; end if;
  if p_estado not in ('pendiente', 'por_revisar', 'confirmada') then raise exception 'Estado inválido.'; end if;
  update public.turnos set sena = p_estado where id = p_id;
  insert into public.historial (turno_id, tipo, detalle) values (p_id, 'sena', case when p_estado = 'confirmada' then 'Seña confirmada' else 'Seña: ' || p_estado end);
end $$;

-- ---------------------------------------------------------------------
-- 5. Seguridad (RLS): todo lo privado, solo la dueña. Los pacientes, solo por las funciones de arriba.
-- ---------------------------------------------------------------------
alter table public.duena          enable row level security;
alter table public.ajustes        enable row level security;
alter table public.modalidades    enable row level security;
alter table public.servicios      enable row level security;
alter table public.bloqueos       enable row level security;
alter table public.pacientes      enable row level security;
alter table public.turnos         enable row level security;
alter table public.historial      enable row level security;
alter table public.retenciones    enable row level security;
alter table public.eventos        enable row level security;
alter table public.notificaciones enable row level security;
alter table public.recordatorios  enable row level security;
alter table public.suscripciones  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ajustes','modalidades','servicios','bloqueos','pacientes','historial','eventos','notificaciones','recordatorios','suscripciones'] loop
    execute format('drop policy if exists duena_todo on public.%I', t);
    execute format('create policy duena_todo on public.%I for all to authenticated using (public.es_duena()) with check (public.es_duena())', t);
  end loop;
end $$;
-- Turnos: la dueña lee y edita (las altas, movidas y cancelaciones van por las funciones duena_*). No se borran: se cancelan.
drop policy if exists duena_lee on public.turnos;
create policy duena_lee on public.turnos for select to authenticated using (public.es_duena());
drop policy if exists duena_edita on public.turnos;
create policy duena_edita on public.turnos for update to authenticated using (public.es_duena()) with check (public.es_duena());
-- duena y retenciones: sin políticas (nadie las toca desde afuera; solo las funciones).

-- Ajustes: nadie inserta ni borra filas (es una sola).
revoke insert, delete on public.ajustes from anon, authenticated;
-- El público no lee ninguna tabla directo.
revoke all on all tables in schema public from anon;

-- Funciones internas: no se llaman desde afuera.
revoke execute on function public.hay_choque(timestamptz, timestamptz, bigint, text) from public, anon, authenticated;
revoke execute on function public.slot_valido(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.ocurrencias_bloqueo(date, date) from public, anon, authenticated;
revoke execute on function public.avisar(text, text, text, text, bigint) from public, anon, authenticated;
-- Funciones públicas (pacientes): las de la sección 3.
grant execute on function public.publico_info() to anon, authenticated;
grant execute on function public.publico_ocupado(date, date, text) to anon, authenticated;
grant execute on function public.retener(text, bigint, text) to anon, authenticated;
grant execute on function public.soltar(text) to anon, authenticated;
grant execute on function public.reservar(text, jsonb) to anon, authenticated;
grant execute on function public.mi_turno(text) to anon, authenticated;
grant execute on function public.cambiar_turno(text, text) to anon, authenticated;
grant execute on function public.registrar_comprobante(text, text) to anon, authenticated;
revoke execute on function public.duena_crear_turno(bigint, bigint, text, bigint, int, text) from anon;
revoke execute on function public.duena_mover_turno(bigint, bigint, text) from anon;
revoke execute on function public.duena_cancelar_turno(bigint, text) from anon;
revoke execute on function public.duena_sena(bigint, text) from anon;

-- ---------------------------------------------------------------------
-- 6. Archivos (Storage): comprobantes e imagen del recordatorio. Privados.
--   * Los pacientes suben SOLO con una URL firmada que da la función "avisos"
--     después de chequear el token del turno. No hay política de subida pública.
--   * Agustina los ve con URLs firmadas que duran 1 hora.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists agustina_comprobantes on storage.objects;
create policy agustina_comprobantes on storage.objects for all to authenticated
  using (bucket_id = 'comprobantes' and public.es_duena()) with check (bucket_id = 'comprobantes' and public.es_duena());
drop policy if exists agustina_imagenes on storage.objects;
create policy agustina_imagenes on storage.objects for all to authenticated
  using (bucket_id = 'imagenes' and public.es_duena()) with check (bucket_id = 'imagenes' and public.es_duena());
