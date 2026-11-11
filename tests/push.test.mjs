// Pruebas de la función de avisos: cifrado Web Push (vector del RFC 8291), VAPID,
// que planAvisos() de la función sea igual al de js/logica.js, y validaciones HTTP.
// Uso: node tests/push.test.mjs   (Node 22.18+ / 24: importa el .ts directo)
import assert from 'node:assert/strict';
import * as F from '../supabase/functions/avisos/index.ts';
import * as L from '../js/logica.js';

let ok = 0, fail = 0;
async function t(nombre, fn) {
  try { await fn(); ok++; console.log('  ok  ', nombre); }
  catch (e) { fail++; console.log('  FALLA', nombre, '\n       ', e.message); }
}
const u = F.unb64u;

console.log('Web Push');
const V = { // RFC 8291, sección 5
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  esperado: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
await t('Vector de prueba del RFC 8291 (byte a byte)', async () => {
  const out = await F.cifrar(u(V.plaintext), V.uaPublic, V.auth, { asPublic: u(V.asPublic), asPrivate: u(V.asPrivate), salt: u(V.salt) });
  assert.equal(F.b64u(out), V.esperado);
});

async function descifrar(body, uaPub, uaPriv, auth) {
  const enc = new TextEncoder();
  const salt = body.slice(0, 16), idlen = body[20], asPub = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const jwk = { kty: 'EC', crv: 'P-256', x: F.b64u(uaPub.slice(1, 33)), y: F.b64u(uaPub.slice(33)), d: F.b64u(uaPriv) };
  const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const pubK = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: pubK }, priv, 256));
  const hm = async (k, d) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d));
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  const ikm = await hm(await hm(auth, ecdh), cat(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])));
  const prk = await hm(salt, ikm);
  const cek = (await hm(prk, cat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hm(prk, cat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, k, ct));
  assert.equal(pt[pt.length - 1], 2);
  return new TextDecoder().decode(pt.slice(0, -1));
}
await t('Ida y vuelta con claves nuevas (lo que hace el celular)', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const d = u((await crypto.subtle.exportKey('jwk', kp.privateKey)).d);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const msg = JSON.stringify({ title: 'Nueva reserva: Sofía', body: 'mañana 10:00 · presencial', url: '#turno/4' });
  const out = await F.cifrar(msg, F.b64u(pub), F.b64u(auth));
  assert.equal(await descifrar(out, pub, d, auth), msg);
});
await t('VAPID: JWT ES256 válido para el origen del endpoint', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const env = { VAPID_PUBLIC: F.b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))), VAPID_PRIVATE: (await crypto.subtle.exportKey('jwk', kp.privateKey)).d };
  const h = await F.vapidHeader('https://web.push.apple.com/QGv7abc', env, Date.parse('2026-11-10T12:00:00Z'));
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(h);
  assert.ok(m);
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.sub, 'mailto:lic.agustina.arrieta@gmail.com');
  const valida = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, Buffer.from(m[3], 'base64url'), new TextEncoder().encode(`${m[1]}.${m[2]}`));
  assert.equal(valida, true);
});

console.log('planAvisos: función = app');
await t('Mismos avisos en 14 días de tramos de 5 min (datos variados)', async () => {
  const PAC = [{ id: 1, nombre: 'Martina Gómez' }, { id: 2, nombre: 'Tomás Rivas' }, { id: 3, nombre: 'Lucía Paz' }];
  const turnos = [];
  let id = 0;
  for (let d = 0; d < 12; d++) for (const h of ['09:00', '15:00', '19:00']) {
    const dia = L.sumarDias('2026-11-10', d);
    const ini = L.msDe(dia, h);
    turnos.push({ id: ++id, paciente_id: (id % 3) + 1, modalidad: id % 2 ? 'presencial' : 'virtual', estado: id % 7 ? 'reservado' : 'cancelado', sena: id % 3 ? 'confirmada' : 'pendiente', inicio: ini, fin: ini + 50 * 60000, creado_at: ini - (id % 5) * 12 * L.HORA, agendado_at: ini - (id % 4) * 10 * L.HORA });
  }
  const eventos = [
    { id: 1, tipo: 'evento', titulo: 'Yoga', fecha: '2026-11-05', hora_inicio: '07:30', hora_fin: '08:30', repetir: 'semanal', aviso_min: 30 },
    { id: 2, tipo: 'evento', titulo: 'Dentista', fecha: '2026-11-19', hora_inicio: '15:30', repetir: 'no', aviso_min: 1440 },
    { id: 3, tipo: 'tarea', titulo: 'Pagar expensas', fecha: '2026-11-12', hecho: false, aviso_min: 0, hora_inicio: '10:00' },
    { id: 4, tipo: 'evento', titulo: 'Feriado', fecha: '2026-11-20', repetir: 'no', aviso_min: 60 },
  ];
  const ajustes = { recordatorio_horas: [24, 8, 2], resumen_hora: '08:00', pendientes_hora: '20:00', avisos: {} };
  let total = 0;
  for (let m = L.msDe('2026-11-10', '00:00'); m < L.msDe('2026-11-24', '00:00'); m += 5 * 60000) {
    const a = L.planAvisos({ ajustes, turnos, pacientes: PAC, eventos }, m - 30 * 60000, m);
    const b = F.planAvisos({ ajustes, turnos, pacientes: PAC, eventos }, m - 30 * 60000, m);
    assert.deepEqual(b, a);
    total += a.length;
  }
  assert.ok(total > 100, 'hubo avisos: ' + total);
});

console.log('HTTP');
await t('OPTIONS responde CORS; GET no; acción desconocida 404', async () => {
  const env = {};
  assert.equal((await F.atender(new Request('https://x/f', { method: 'OPTIONS' }), env)).status, 200);
  assert.equal((await F.atender(new Request('https://x/f', { method: 'GET' }), env)).status, 405);
  assert.equal((await F.atender(new Request('https://x/f', { method: 'POST', body: '{"accion":"nada"}' }), env)).status, 404);
  assert.equal((await F.atender(new Request('https://x/f', { method: 'POST', body: 'no json' }), env)).status, 400);
});
await t('Subida: rechaza token o tipo inválido sin tocar la base', async () => {
  assert.equal((await F.urlSubida({}, 'corto', 'image/jpeg')).status, 400);
  assert.equal((await F.urlSubida({}, 'a'.repeat(32), 'text/html')).status, 400);
});

console.log(`\n${ok} ok, ${fail} con falla`);
process.exit(fail ? 1 : 0);
