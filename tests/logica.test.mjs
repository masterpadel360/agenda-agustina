// Pruebas de la lógica pura: horarios libres, edad, regla de 24 h, avisos programados, plantillas.
// Uso: node tests/logica.test.mjs
import assert from 'node:assert/strict';
import * as L from '../js/logica.js';

let ok = 0, fail = 0;
async function t(nombre, fn) {
  try { await fn(); ok++; console.log('  ok  ', nombre); }
  catch (e) { fail++; console.log('  FALLA', nombre, '\n       ', e.message); }
}

const PRES = { id: 'presencial', activa: true, duracion: 50, descanso: 10, horario: { 1: [['09:00', '13:00'], ['15:00', '19:00']], 3: [['09:00', '13:00'], ['15:00', '19:00']], 5: [['09:00', '13:00']] } };
const VIRT = { id: 'virtual', activa: true, duracion: 45, descanso: 15, horario: { 2: [['17:00', '21:00']], 3: [['19:00', '21:00']], 4: [['17:00', '21:00']] } };
const LUNES = '2026-11-16';
const AHORA = L.msDe('2026-11-10', '12:00'); // martes 10/11 al mediodía
const horas = (sl) => sl.map((s) => s.hora);
const base = { ahora: AHORA, bloqueos: [], ocupados: [], anticipacionHoras: 12, horizonteDias: 30 };

console.log('Fechas');
await t('Córdoba es UTC-3: 09:00 local = 12:00 UTC', () => {
  assert.equal(new Date(L.msDe(LUNES, '09:00')).toISOString(), '2026-11-16T12:00:00.000Z');
  assert.equal(L.diaDe(Date.parse('2026-11-17T02:30:00Z')), LUNES); // 23:30 del lunes en Córdoba
  assert.equal(L.horaDe(Date.parse('2026-11-17T02:30:00Z')), '23:30');
});
await t('Día de la semana y lunes de la semana', () => {
  assert.equal(L.diaSemana(LUNES), 1);
  assert.equal(L.diaSemana('2026-11-22'), 7);
  assert.equal(L.lunesDe('2026-11-19'), LUNES);
  assert.equal(L.fechaLarga('2026-11-18'), 'miércoles 18 nov');
});

console.log('Horarios libres por modalidad');
await t('Presencial lunes: 9 a 13 y 15 a 19, de 50 + 10 min', () => {
  assert.deepEqual(horas(L.slotsLibres({ ...base, mod: PRES, dia: LUNES })), ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00']);
});
await t('Virtual tiene su propio horario y duración (45 + 15)', () => {
  assert.deepEqual(horas(L.slotsLibres({ ...base, mod: VIRT, dia: LUNES })), []);
  const mar = L.slotsLibres({ ...base, mod: VIRT, dia: '2026-11-17' });
  assert.deepEqual(horas(mar), ['17:00', '18:00', '19:00', '20:00']);
  assert.equal(mar[0].fin - mar[0].inicio, 45 * 60000);
});
await t('Día bloqueado (vacaciones) no ofrece nada; bloqueo de una sola modalidad', () => {
  assert.deepEqual(L.slotsLibres({ ...base, mod: PRES, dia: LUNES, bloqueos: [{ desde: '2026-11-15', hasta: '2026-11-17' }] }), []);
  assert.equal(L.slotsLibres({ ...base, mod: PRES, dia: LUNES, bloqueos: [{ desde: LUNES, hasta: LUNES, modalidad: 'virtual' }] }).length, 8);
});
await t('Turnos ocupados y horarios guardados de otros no aparecen; el propio sí', () => {
  const turnos = [{ id: 1, estado: 'reservado', inicio: L.msDe(LUNES, '09:00'), fin: L.msDe(LUNES, '09:50') }, { id: 2, estado: 'cancelado', inicio: L.msDe(LUNES, '10:00'), fin: L.msDe(LUNES, '10:50') }];
  const retenciones = [{ token: 'ajena', inicio: L.msDe(LUNES, '11:00'), fin: L.msDe(LUNES, '11:50'), expira: AHORA + 60000 },
    { token: 'mia', inicio: L.msDe(LUNES, '12:00'), fin: L.msDe(LUNES, '12:50'), expira: AHORA + 60000 },
    { token: 'vencida', inicio: L.msDe(LUNES, '15:00'), fin: L.msDe(LUNES, '15:50'), expira: AHORA - 1 }];
  const occ = L.ocupados({ turnos, retenciones, excluirRet: 'mia', desdeDia: LUNES, hastaDia: LUNES, ahora: AHORA });
  assert.deepEqual(horas(L.slotsLibres({ ...base, mod: PRES, dia: LUNES, ocupados: occ })), ['10:00', '12:00', '15:00', '16:00', '17:00', '18:00']);
});
await t('Mi vida con "bloquear" saca los horarios que pisa (también si se repite cada semana)', () => {
  const eventos = [
    { id: 1, tipo: 'evento', titulo: 'Dentista', fecha: LUNES, hora_inicio: '10:30', hora_fin: '11:30', repetir: 'no', bloquea: true },
    { id: 2, tipo: 'evento', titulo: 'Yoga', fecha: '2026-11-02', hora_inicio: '17:30', hora_fin: '18:00', repetir: 'semanal', bloquea: true },
    { id: 3, tipo: 'evento', titulo: 'Almuerzo', fecha: LUNES, hora_inicio: '15:00', hora_fin: '16:00', repetir: 'no', bloquea: false },
  ];
  const occ = L.ocupados({ eventos, desdeDia: LUNES, hastaDia: LUNES, ahora: AHORA });
  assert.deepEqual(horas(L.slotsLibres({ ...base, mod: PRES, dia: LUNES, ocupados: occ })), ['09:00', '12:00', '15:00', '16:00', '18:00']);
});
await t('Evento de todo el día que bloquea saca el día entero', () => {
  const occ = L.ocupados({ eventos: [{ id: 9, tipo: 'evento', titulo: 'Congreso', fecha: LUNES, repetir: 'no', bloquea: true }], desdeDia: LUNES, hastaDia: LUNES, ahora: AHORA });
  assert.deepEqual(L.slotsLibres({ ...base, mod: PRES, dia: LUNES, ocupados: occ }), []);
});
await t('Anticipación mínima y horizonte', () => {
  const ahora = L.msDe(LUNES, '08:00');
  assert.deepEqual(horas(L.slotsLibres({ ...base, ahora, mod: PRES, dia: LUNES })), []); // 12 h: nada hasta las 20
  assert.deepEqual(horas(L.slotsLibres({ ...base, ahora, anticipacionHoras: 2, mod: PRES, dia: LUNES })), ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00']);
  assert.equal(L.slotsLibres({ ...base, mod: PRES, dia: '2026-12-11', horizonteDias: 30 }).length, 0); // más allá de 30 días
  assert.equal(L.slotsLibres({ ...base, mod: PRES, dia: '2026-12-09', horizonteDias: 30 }).length, 8);
});
await t('esSlotValido: solo inicios de la grilla', () => {
  const a = { ...base, mod: PRES, bloqueos: [] };
  assert.equal(L.esSlotValido({ ...a, inicio: L.msDe(LUNES, '10:00') }), true);
  assert.equal(L.esSlotValido({ ...a, inicio: L.msDe(LUNES, '10:30') }), false);
  assert.equal(L.esSlotValido({ ...a, inicio: L.msDe(LUNES, '12:30') }), false);
  assert.equal(L.esSlotValido({ ...a, inicio: L.msDe('2026-11-17', '10:00') }), false); // martes: no atiende presencial
});
await t('Días disponibles y texto del horario', () => {
  const d = L.diasDisponibles({ ...base, mod: PRES }, LUNES, 7);
  assert.deepEqual(d.map((x) => x.libres), [8, 0, 8, 0, 4, 0, 0]);
  assert.equal(L.textoHorario(PRES), 'Lun y mié 9–13 y 15–19 h · Vie 9–13 h');
  assert.equal(L.textoHorario({ ...PRES, activa: false }), 'Sin horarios por ahora');
});

console.log('Edad');
await t('Menos de 15 no reserva; 15 a 17 pide adulto; 18+ ok; cumpleaños justo', () => {
  const hoy = '2026-11-10';
  assert.equal(L.reglaEdad('2012-01-01', hoy), 'menor');
  assert.equal(L.reglaEdad('2011-11-11', hoy), 'menor');      // cumple 15 mañana
  assert.equal(L.reglaEdad('2011-11-10', hoy), 'responsable'); // cumple 15 hoy
  assert.equal(L.reglaEdad('2010-05-03', hoy), 'responsable');
  assert.equal(L.reglaEdad('2008-11-10', hoy), 'ok');
  assert.equal(L.reglaEdad('', hoy), 'invalida');
});
await t('validarDatos', () => {
  const hoy = '2026-11-10';
  const d = { nombre: 'Sofía Méndez', telefono: '351 555-0142', email: '', nacimiento: '1995-03-02', primera_vez: true, motivo: '' };
  assert.equal(L.validarDatos(d, hoy), null);
  assert.match(L.validarDatos({ ...d, nacimiento: '2013-01-01' }, hoy), /desde los 15/);
  assert.match(L.validarDatos({ ...d, nacimiento: '2010-05-03' }, hoy), /adulto responsable/);
  assert.equal(L.validarDatos({ ...d, nacimiento: '2010-05-03', responsable_nombre: 'Laura Méndez', responsable_telefono: '3515550199' }, hoy), null);
  assert.match(L.validarDatos({ ...d, telefono: '123' }, hoy), /WhatsApp/);
  assert.match(L.validarDatos({ ...d, email: 'sofi@' }, hoy), /mail/);
  assert.match(L.validarDatos({ ...d, primera_vez: undefined }, hoy), /primera vez/);
});

console.log('Cambio de turno (24 h)');
await t('Se puede cambiar solo si faltan MÁS de 24 h', () => {
  const ini = L.msDe(LUNES, '10:00');
  assert.equal(L.puedeCambiar(ini, ini - 25 * L.HORA), true);
  assert.equal(L.puedeCambiar(ini, ini - 24 * L.HORA), false);
  assert.equal(L.puedeCambiar(ini, ini - 23 * L.HORA), false);
  assert.equal(L.puedeCambiar(ini, ini - 9 * L.HORA, 8), true); // si ella pone 8 h
  assert.equal(L.horaDe(L.limiteCambio(ini)), '10:00');
  assert.equal(L.diaDe(L.limiteCambio(ini)), '2026-11-15');
});

console.log('Avisos programados');
const AJ = { recordatorio_horas: [24, 8], resumen_hora: '08:00', pendientes_hora: '20:00', avisos: {}, link_videollamada: 'https://meet.example/agus' };
const PAC = [{ id: 7, nombre: 'Martina Gómez' }, { id: 8, nombre: 'Joaquín Ferrero' }];
const T1 = { id: 11, paciente_id: 7, modalidad: 'presencial', estado: 'reservado', sena: 'confirmada', inicio: L.msDe('2026-11-19', '18:00'), fin: L.msDe('2026-11-19', '18:50'), creado_at: L.msDe('2026-11-01', '10:00') };
const T2 = { id: 12, paciente_id: 8, modalidad: 'virtual', estado: 'reservado', sena: 'por_revisar', inicio: L.msDe('2026-11-19', '09:00'), fin: L.msDe('2026-11-19', '09:50'), creado_at: L.msDe('2026-11-18', '20:00') };
await t('Recordatorio 24 h y 8 h antes ("Recordale a Martina: mañana 18:00")', () => {
  const p = L.planAvisos({ ajustes: AJ, turnos: [T1], pacientes: PAC }, L.msDe('2026-11-18', '17:55'), L.msDe('2026-11-18', '18:00'));
  assert.equal(p.length, 1);
  assert.equal(p[0].tipo, 'recordatorio');
  assert.equal(p[0].titulo, 'Recordale a Martina');
  assert.match(p[0].cuerpo, /^mañana 18:00 · presencial/);
  assert.equal(p[0].url, '#recordar/11');
  const p8 = L.planAvisos({ ajustes: AJ, turnos: [T1], pacientes: PAC }, L.msDe('2026-11-19', '09:59'), L.msDe('2026-11-19', '10:00'));
  assert.equal(p8.length, 1);
  assert.match(p8[0].cuerpo, /^hoy 18:00/);
});
await t('Si reservó después de la hora del recordatorio, no se pide', () => {
  const p = L.planAvisos({ ajustes: AJ, turnos: [T2], pacientes: PAC }, L.msDe('2026-11-18', '08:00'), L.msDe('2026-11-18', '09:30'));
  assert.equal(p.filter((a) => a.tipo === 'recordatorio').length, 0);
});
await t('Turno cancelado o recordatorios apagados: nada', () => {
  const desde = L.msDe('2026-11-18', '17:55'), hasta = L.msDe('2026-11-18', '18:00');
  assert.equal(L.planAvisos({ ajustes: AJ, turnos: [{ ...T1, estado: 'cancelado' }], pacientes: PAC }, desde, hasta).length, 0);
  assert.equal(L.planAvisos({ ajustes: { ...AJ, avisos: { recordatorios: false } }, turnos: [T1], pacientes: PAC }, desde, hasta).length, 0);
});
await t('Resumen del día a las 8:00 con sesiones, señas y cosas propias', () => {
  const ev = [{ id: 1, tipo: 'evento', titulo: 'Yoga', fecha: '2026-11-19', hora_inicio: '07:30', repetir: 'no' }];
  const p = L.planAvisos({ ajustes: AJ, turnos: [T1, T2], pacientes: PAC, eventos: ev }, L.msDe('2026-11-19', '07:58'), L.msDe('2026-11-19', '08:03'));
  const r = p.find((a) => a.tipo === 'resumen');
  assert.equal(r.clave, 'resumen:2026-11-19');
  assert.equal(r.cuerpo, 'Hoy tenés 2 sesiones: 09:00 Joaquín · 18:00 Martina · 1 cosa tuya · 1 seña sin confirmar.');
});
await t('Mi vida: aviso 30 min antes, cada semana, y tareas pendientes a las 20:00', () => {
  const ev = [
    { id: 5, tipo: 'evento', titulo: 'Dentista', fecha: '2026-11-19', hora_inicio: '15:30', hora_fin: '16:30', repetir: 'no', aviso_min: 30 },
    { id: 6, tipo: 'evento', titulo: 'Yoga', fecha: '2026-11-05', hora_inicio: '07:30', repetir: 'semanal', aviso_min: 60 },
    { id: 7, tipo: 'tarea', titulo: 'Pagar expensas', fecha: '2026-11-18', hecho: false },
    { id: 8, tipo: 'tarea', titulo: 'Llamar al contador', hecho: false },
    { id: 9, tipo: 'tarea', titulo: 'Hecha', hecho: true },
  ];
  const dent = L.planAvisos({ ajustes: AJ, eventos: ev }, L.msDe('2026-11-19', '14:58'), L.msDe('2026-11-19', '15:03'));
  assert.deepEqual(dent.map((a) => [a.tipo, a.titulo, a.cuerpo]), [['vida', 'Dentista', 'En 30 min · 15:30']]);
  const yoga = L.planAvisos({ ajustes: AJ, eventos: ev }, L.msDe('2026-11-26', '06:28'), L.msDe('2026-11-26', '06:33'));
  assert.deepEqual(yoga.map((a) => a.clave), ['vida:6:2026-11-26:60']);
  const pend = L.planAvisos({ ajustes: AJ, eventos: ev }, L.msDe('2026-11-19', '19:58'), L.msDe('2026-11-19', '20:03'));
  assert.equal(pend[0].titulo, 'Te quedan 2 cosas para hacer');
  assert.equal(pend[0].cuerpo, 'Pagar expensas · Llamar al contador');
});
await t('Un tramo de 30 min alrededor de la hora no repite claves', () => {
  const p1 = L.planAvisos({ ajustes: AJ, turnos: [T1], pacientes: PAC }, L.msDe('2026-11-18', '17:30'), L.msDe('2026-11-18', '18:00'));
  const p2 = L.planAvisos({ ajustes: AJ, turnos: [T1], pacientes: PAC }, L.msDe('2026-11-18', '17:35'), L.msDe('2026-11-18', '18:05'));
  assert.deepEqual(p1.map((a) => a.clave), p2.map((a) => a.clave)); // misma clave → la base la guarda una sola vez
});

console.log('Mensajes');
await t('Texto del recordatorio con variables; link solo en virtual', () => {
  const pres = L.textoRecordatorio(T1, PAC[0], AJ);
  assert.match(pres, /^Hola Martina! Te recuerdo tu sesión el jueves 19 nov a las 18:00 \(presencial\)\./);
  assert.ok(!pres.includes('Link'));
  assert.match(pres, /se abona igualmente/);
  const virt = L.textoRecordatorio(T2, PAC[1], AJ);
  assert.match(virt, /\(virtual\)\. Link: https:\/\/meet\.example\/agus/);
  assert.equal(L.llenarPlantilla('{nombre} {otra}', { nombre: 'Ana' }), 'Ana {otra}');
});
await t('Textos de la imagen del recordatorio', () => {
  assert.equal(L.textoDiaImagen(L.msDe('2026-11-11', '18:00')), 'Miércoles 11 de noviembre');
  assert.equal(L.textoHoraImagen(L.msDe('2026-11-11', '18:00')), '18:00 hs');
});
await t('Número de WhatsApp argentino', () => {
  assert.equal(L.numeroWa('351 555-0100'), '5493515550100');
  assert.equal(L.numeroWa('+54 9 351 555 0100'), '5493515550100');
  assert.equal(L.numeroWa('0351 15 555 0100'), '5493515550100');
  assert.equal(L.numeroWa('54 351 5550100'), '5493515550100');
  assert.equal(L.linkWa('3515550100', 'Hola!'), 'https://wa.me/5493515550100?text=Hola!');
});
await t('Avisos al instante', () => {
  const a = L.avisoInstante('reserva', { nombre: 'Sofía Méndez', inicio: L.msDe('2026-11-11', '10:00'), modalidad: 'presencial' }, L.msDe('2026-11-10', '21:00'));
  assert.deepEqual(a, { titulo: 'Nueva reserva: Sofía Méndez', cuerpo: 'mañana 10:00 · presencial' });
});

console.log(`\n${ok} ok, ${fail} con falla`);
process.exit(fail ? 1 : 0);
