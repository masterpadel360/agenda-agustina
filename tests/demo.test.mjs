// Pruebas de la capa DEMO: las mismas reglas que las funciones de supabase/schema.sql.
// Uso: node tests/demo.test.mjs
import assert from 'node:assert/strict';
import * as L from '../js/logica.js';
import { crearDemo, TOKEN_LEJOS, TOKEN_CERCA } from '../js/datos-demo.js';

let ok = 0, fail = 0;
async function t(nombre, fn) {
  try { await fn(); ok++; console.log('  ok  ', nombre); }
  catch (e) { fail++; console.log('  FALLA', nombre, '\n       ', e.message); }
}
const rechaza = async (fn, re) => { try { await fn(); } catch (e) { assert.match(e.message, re); return; } throw new Error('debía fallar'); };

const AHORA = L.msDe('2026-11-10', '12:00');
const d = crearDemo({ reloj: () => AHORA });
const P = d.publico;
const info = await P.info();
const pres = info.modalidades.find((m) => m.id === 'presencial');
async function libres(dia, ret = null) {
  return L.slotsLibres({ mod: pres, dia, ahora: AHORA, bloqueos: info.bloqueos, ocupados: await P.ocupado(dia, dia, ret), anticipacionHoras: info.anticipacion_horas, horizonteDias: info.horizonte_dias });
}
let dia = null, sl = [];
for (let i = 1; i < 14 && sl.length < 2; i++) { dia = L.sumarDias('2026-11-10', i); sl = await libres(dia); }
const datos = { nombre: 'Paciente Prueba', telefono: '351 555-0999', nacimiento: '1990-01-01', primera_vez: true, email: '', motivo: 'privado' };

console.log('Reserva');
await t('Datos públicos sin motivos de bloqueo ni datos de pacientes', () => {
  assert.ok(!JSON.stringify(info).includes('Vacaciones'));
  assert.ok(!JSON.stringify(info).match(/Martina|telefono|link_videollamada/));
});
await t('Retención: bloquea a otros, no a uno mismo; se reemplaza al elegir otro', async () => {
  const r = await P.retener('presencial', sl[0].inicio, null);
  assert.ok(!(await libres(dia)).some((s) => s.inicio === sl[0].inicio));
  assert.ok((await libres(dia, r.token)).some((s) => s.inicio === sl[0].inicio));
  await rechaza(() => P.retener('presencial', sl[0].inicio, null), /ocupar/);
  const r2 = await P.retener('presencial', sl[1].inicio, r.token);
  assert.equal(r2.token, r.token);
  assert.ok((await libres(dia)).some((s) => s.inicio === sl[0].inicio)); // el anterior se soltó
  await P.soltar(r.token);
  assert.ok((await libres(dia)).some((s) => s.inicio === sl[1].inicio));
});
await t('Horario fuera de la grilla: rechazado', async () => {
  await rechaza(() => P.retener('presencial', sl[0].inicio + 30 * 60000, null), /no está disponible/);
});
await t('Menor de 15 y 15-17 sin adulto: rechazados', async () => {
  const r = await P.retener('presencial', sl[0].inicio, null);
  await rechaza(() => P.reservar(r.token, { ...datos, nacimiento: '2013-01-01' }), /15 años/);
  await rechaza(() => P.reservar(r.token, { ...datos, nacimiento: '2010-01-01' }), /adulto responsable/);
  await P.soltar(r.token);
});
let tk;
await t('Reserva completa, una persona por horario', async () => {
  const r = await P.retener('presencial', sl[0].inicio, null);
  const res = await P.reservar(r.token, datos);
  tk = res.token;
  assert.ok(tk.length >= 16);
  await rechaza(() => P.retener('presencial', sl[0].inicio, null), /ocupar/);
  const mt = await P.miTurno(tk);
  assert.equal(mt.nombre, 'Paciente');
  assert.equal(mt.sena, 'pendiente');
  assert.equal(mt.puede_cambiar, true);
});
await t('Comprobante solo con el token del turno', async () => {
  const f = new File([new Uint8Array(2000)], 'c.jpg', { type: 'image/jpeg' });
  await rechaza(() => P.subirComprobante('token-que-no-existe-123', f), /No encontramos/);
  await rechaza(() => P.subirComprobante(tk, new File(['x'], 'a.html', { type: 'text/html' })), /foto/);
  await P.subirComprobante(tk, f);
  const mt = await P.miTurno(tk);
  assert.equal(mt.sena, 'por_revisar');
  assert.equal(mt.comprobante, true);
});

console.log('Cambios');
await t('Más de 24 h: se cambia', async () => {
  const antes = await P.miTurno(TOKEN_LEJOS);
  const dd = L.diaDe(antes.inicio);
  const otro = (await libres(dd)).find((s) => s.inicio !== antes.inicio) || (await libres(L.sumarDias(dd, 2)))[0];
  const r = await P.retener('presencial', otro.inicio, null);
  await P.cambiarTurno(TOKEN_LEJOS, r.token);
  assert.equal((await P.miTurno(TOKEN_LEJOS)).inicio, otro.inicio);
});
await t('Menos de 24 h: bloqueado', async () => {
  const mt = await P.miTurno(TOKEN_CERCA);
  assert.equal(mt.puede_cambiar, false);
  const virt = info.modalidades.find((m) => m.id === 'virtual');
  let s = null;
  for (let i = 1; i < 14 && !s; i++) { const dd = L.sumarDias('2026-11-10', i); s = L.slotsLibres({ mod: virt, dia: dd, ahora: AHORA, bloqueos: [], ocupados: await P.ocupado(dd, dd), anticipacionHoras: 12, horizonteDias: 30 })[0]; }
  const r = await P.retener('virtual', s.inicio, null);
  await rechaza(() => P.cambiarTurno(TOKEN_CERCA, r.token), /menos de 24 h/);
});

console.log('Panel');
await t('Mi vida con "bloquear" saca el horario de la página de reservas', async () => {
  const s = (await libres(dia))[0];
  await d.panel.guardarEvento({ tipo: 'evento', titulo: 'Médico', fecha: dia, hora_inicio: L.horaDe(s.inicio), hora_fin: L.horaDe(s.inicio + 30 * 60000), repetir: 'no', aviso_min: 30, bloquea: true });
  assert.ok(!(await libres(dia)).some((x) => x.inicio === s.inicio));
});
await t('Agustina no puede pisar dos turnos', async () => {
  const S = await d.panel.cargar();
  const t1 = S.turnos.find((x) => x.estado === 'reservado' && x.inicio > AHORA);
  await assert.rejects(() => d.panel.crearTurno({ paciente_id: 1, servicio_id: 1, modalidad: 'presencial', inicio: t1.inicio }), /otro turno/);
});
await t('El "cron" de la demo genera el recordatorio de 24 h y el aviso queda en la campanita', async () => {
  const S = await d.panel.cargar();
  assert.ok(S.recordatorios.some((r) => r.estado === 'pendiente'));
  assert.ok(S.notificaciones.some((n) => n.tipo === 'recordatorio' && n.titulo.startsWith('Recordale a')));
  assert.ok(S.notificaciones.some((n) => n.tipo === 'reserva'));
});

console.log(`\n${ok} ok, ${fail} con falla`);
process.exit(fail ? 1 : 0);
