-- =====================================================================
-- OPCIONAL: datos de prueba para ver el panel con algo adentro antes de usarlo de verdad.
-- Pacientes y turnos INVENTADOS (teléfonos 351 555-01xx). Correr después de schema.sql.
-- Para borrarlos, corré el bloque "BORRAR DATOS DE PRUEBA" del final.
-- =====================================================================
insert into public.pacientes (nombre, telefono, nacimiento, notas) values
  ('Prueba Martina Gómez', '351 555-0111', '1994-04-12', 'Paciente de prueba'),
  ('Prueba Tomás Rivas',   '351 555-0112', '2002-01-30', 'Paciente de prueba'),
  ('Prueba Sofía Méndez',  '351 555-0118', '2010-05-03', 'Paciente de prueba');
update public.pacientes set responsable_nombre = 'Laura Méndez (mamá)', responsable_telefono = '351 555-0199' where nombre = 'Prueba Sofía Méndez';

-- Tres turnos en los próximos días, sobre la grilla presencial de ejemplo (lunes/miércoles 9 a 13).
with prox as (
  select d::date as dia from generate_series(public.hoy_cba() + 1, public.hoy_cba() + 14, interval '1 day') d
  where extract(isodow from d) in (1, 3) limit 3
), filas as (
  select row_number() over (order by dia) as n, dia from prox
)
insert into public.turnos (token, paciente_id, servicio_id, modalidad, inicio, fin, origen, sena)
select public.nuevo_token(),
       (select id from public.pacientes where nombre like 'Prueba %' order by id offset (f.n - 1) limit 1),
       (select id from public.servicios order by id limit 1),
       'presencial',
       (f.dia + time '10:00') at time zone 'America/Argentina/Cordoba',
       (f.dia + time '10:50') at time zone 'America/Argentina/Cordoba',
       'agustina', case when f.n = 2 then 'pendiente' else 'confirmada' end
from filas f;

insert into public.eventos (tipo, titulo, fecha, hora_inicio, hora_fin, repetir, aviso_min, bloquea, color) values
  ('evento', 'Prueba: yoga', public.hoy_cba() + 1, '07:30', '08:30', 'semanal', 30, false, '#2CC253'),
  ('tarea',  'Prueba: llamar al contador', public.hoy_cba(), null, null, 'no', null, false, '#8A4BF2');

-- ---------------------------------------------------------------------
-- BORRAR DATOS DE PRUEBA (copiar y correr solo estas 2 líneas):
-- delete from public.pacientes where nombre like 'Prueba %';   -- borra también sus turnos
-- delete from public.eventos where titulo like 'Prueba:%';
