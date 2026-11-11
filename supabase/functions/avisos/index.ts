// =====================================================================
// Función "avisos" (Supabase Edge Function, Deno). Sin dependencias.
//
// Hace tres cosas (POST con JSON { accion }):
//   * "despachar": arma los avisos programados que tocan (recordatorios a pacientes,
//     Mi vida, resumen de las 8:00, pendientes de las 20:00) y manda por Web Push
//     todo lo que esté en la cola (reservas, cambios, comprobantes). La llama pg_cron
//     cada 5 minutos y también la página de reservas apenas alguien reserva (así el
//     aviso llega al instante). Es idempotente: nunca manda dos veces lo mismo.
//   * "subida": da una URL firmada para subir UN comprobante, solo si el token del
//     turno existe. Es la única forma de subir archivos al bucket "comprobantes".
//   * "probar": manda un aviso de prueba (solo con la sesión de Agustina).
//
// Secretos (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC   clave pública (base64url, 65 bytes)  ← node herramientas/generar-vapid.mjs
//   VAPID_PRIVATE  clave privada "d" (base64url, 32 bytes)
//   VAPID_SUBJECT  mailto:lic.agustina.arrieta@gmail.com
//   (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen puestas por Supabase.)
//
// Cifrado aes128gcm (RFC 8291) y firma VAPID (RFC 8292) con WebCrypto.
// planAvisos() es copia de js/logica.js: mantenerlas iguales (tests/push.test.mjs lo verifica).
//
// RECORDATORIOS AUTOMÁTICOS POR WHATSAPP (para más adelante):
//   Hoy cada recordatorio le llega a Agustina como aviso y ella lo manda con un toque.
//   Para que salga solo (API de WhatsApp Business Cloud, pago por mensaje):
//   1) completar emisorWhatsAppAPI() más abajo (POST a graph.facebook.com/v20.0/<PHONE_ID>/messages
//      con una plantilla aprobada por Meta + imagen), con secretos WA_TOKEN y WA_PHONE_ID;
//   2) poner ajustes.recordatorio_canal = 'whatsapp_api'.
//   Si el envío automático falla, el recordatorio vuelve al modo manual (aviso a Agustina).
// =====================================================================

declare const Deno: any;

const VENTANA_MS = 30 * 60 * 1000; // si el cron se atrasa, igual sale hasta 30 min tarde

// ---------------------------------------------------------------- base64url y bytes
const enc = new TextEncoder();
export function b64u(bytes: Uint8Array | ArrayBuffer): string {
  let s = '';
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s: string): Uint8Array {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
const jwkDe = (pub: Uint8Array, d?: Uint8Array) => ({ kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ...(d ? { d: b64u(d) } : {}), ext: true });

// ---------------------------------------------------------------- Cifrado (RFC 8291, aes128gcm)
// prueba (solo tests): { asPublic, asPrivate, salt } fijos para comparar con el vector del RFC.
export async function cifrar(texto: string | Uint8Array, p256dh: string | Uint8Array, auth: string | Uint8Array, prueba: any = null): Promise<Uint8Array> {
  const uaPublic = typeof p256dh === 'string' ? unb64u(p256dh) : p256dh;
  const authSecret = typeof auth === 'string' ? unb64u(auth) : auth;
  let asPublic: Uint8Array, asPrivKey: CryptoKey;
  if (prueba) {
    asPublic = prueba.asPublic;
    asPrivKey = await crypto.subtle.importKey('jwk', jwkDe(asPublic, prueba.asPrivate), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  } else {
    const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer);
    asPrivKey = kp.privateKey;
  }
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivKey, 256));
  const prkKey = await hmac(authSecret, ecdh);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  const salt = prueba ? prueba.salt : crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const datos = concat(typeof texto === 'string' ? enc.encode(texto) : texto, new Uint8Array([2])); // 0x02 = último registro
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, datos));
  const rs = 4096;
  const head = concat(salt, new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255, asPublic.length]), asPublic);
  return concat(head, cifrado);
}

// ---------------------------------------------------------------- VAPID (RFC 8292)
export async function vapidHeader(endpoint: string, env: any, now = Date.now()): Promise<string> {
  const pub = unb64u(env.VAPID_PUBLIC);
  const key = await crypto.subtle.importKey('jwk', jwkDe(pub, unb64u(env.VAPID_PRIVATE)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:lic.agustina.arrieta@gmail.com' })));
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `vapid t=${head}.${body}.${b64u(firma)}, k=${env.VAPID_PUBLIC}`;
}

export async function enviarPush(sub: any, payload: any, env: any, ttl = 3600): Promise<number> {
  const body = await cifrar(JSON.stringify(payload), sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'high',
    },
    body,
  });
  return r.status;
}

// ---------------------------------------------------------------- copia de js/logica.js (fechas + planAvisos)
const OFFSET_MS = -3 * 3600e3;
const HORA = 3600e3;
const DIA = 24 * HORA;
const pad = (n: number) => String(n).padStart(2, '0');
const diaDe = (ms: number) => new Date(ms + OFFSET_MS).toISOString().slice(0, 10);
const horaDe = (ms: number) => new Date(ms + OFFSET_MS).toISOString().slice(11, 16);
function minutos(hhmm: any): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const hhmm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
function msDe(dia: string, hora = '00:00'): number {
  const [y, mo, d] = dia.split('-').map(Number);
  return Date.UTC(y, mo - 1, d) + (minutos(hora) as number) * 60000 - OFFSET_MS;
}
function sumarDias(dia: string, n: number): string {
  const [y, mo, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}
function diaSemana(dia: string): number {
  const [y, mo, d] = dia.split('-').map(Number);
  return ((new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7) + 1;
}
const DIAS_LARGOS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaLarga = (dia: string) => `${DIAS_LARGOS[diaSemana(dia)]} ${Number(dia.slice(8))} ${MESES[Number(dia.slice(5, 7)) - 1]}`;
function cuando(ms: number, ahora: number): string {
  const d = diaDe(ms), h = diaDe(ahora);
  if (d === h) return 'hoy';
  if (d === sumarDias(h, 1)) return 'mañana';
  return `el ${DIAS_LARGOS[diaSemana(d)]} ${Number(d.slice(8))}`;
}
const primerNombre = (n: any) => String(n || '').trim().split(/\s+/)[0] || '';
function ocurrencias(eventos: any[], desdeDia: string, hastaDia: string): any[] {
  const out: any[] = [];
  for (const ev of eventos || []) {
    if (!ev.fecha) continue;
    if (ev.repetir === 'semanal') {
      let d = ev.fecha;
      const dow = diaSemana(ev.fecha);
      if (d < desdeDia) d = sumarDias(desdeDia, (dow - diaSemana(desdeDia) + 7) % 7);
      for (; d <= hastaDia; d = sumarDias(d, 7)) out.push(ocurrencia(ev, d));
    } else if (ev.fecha >= desdeDia && ev.fecha <= hastaDia) out.push(ocurrencia(ev, ev.fecha));
  }
  return out.sort((a, b) => a.inicio - b.inicio);
}
function ocurrencia(ev: any, dia: string) {
  const conHora = minutos(ev.hora_inicio) != null;
  const inicio = conHora ? msDe(dia, ev.hora_inicio) : msDe(dia, '00:00');
  let fin = conHora && minutos(ev.hora_fin) != null ? msDe(dia, ev.hora_fin) : (conHora ? inicio + HORA : inicio + DIA);
  if (fin <= inicio) fin = inicio + HORA;
  return { evento: ev, dia, inicio, fin, todoElDia: !conHora };
}

export function planAvisos({ ajustes, turnos = [], pacientes = [], eventos = [] }: any, desde: number, hasta: number): any[] {
  const av = (ajustes && ajustes.avisos) || {};
  const out: any[] = [];
  const nombreDe = new Map(pacientes.map((p: any) => [p.id, p.nombre]));
  const en = (at: number) => at > desde && at <= hasta;

  if (av.recordatorios !== false) {
    for (const t of turnos) {
      if (t.estado !== 'reservado' || t.inicio <= desde) continue;
      for (const h of ajustes.recordatorio_horas || []) {
        const at = t.inicio - Number(h) * HORA;
        if (!en(at)) continue;
        if (at < (t.agendado_at || t.creado_at || 0)) continue;
        const nom = primerNombre(nombreDe.get(t.paciente_id)) || 'tu paciente';
        out.push({
          clave: `rec:${t.id}:${h}:${t.inicio}`, at, tipo: 'recordatorio', turno_id: t.id, horas: Number(h),
          titulo: `Recordale a ${nom}`, cuerpo: `${cuando(t.inicio, at)} ${horaDe(t.inicio)} · ${t.modalidad === 'virtual' ? 'virtual' : 'presencial'}. Tocá para mandarle el WhatsApp.`,
          url: `#recordar/${t.id}`,
        });
      }
    }
  }
  const dias: string[] = [];
  for (let d = diaDe(desde); d <= diaDe(hasta); d = sumarDias(d, 1)) dias.push(d);

  if (av.vida !== false) {
    for (const o of ocurrencias(eventos, sumarDias(dias[0], -1), sumarDias(dias[dias.length - 1], 2))) {
      const ev = o.evento;
      if (ev.aviso_min == null || ev.aviso_min === '' || o.todoElDia || (ev.tipo === 'tarea' && ev.hecho)) continue;
      const at = o.inicio - Number(ev.aviso_min) * 60000;
      if (!en(at)) continue;
      const falta = Number(ev.aviso_min);
      const txt = falta === 0 ? 'Ahora' : falta < 60 ? `En ${falta} min` : falta < 1440 ? `En ${falta / 60} h` : 'Mañana';
      out.push({ clave: `vida:${ev.id}:${o.dia}:${falta}`, at, tipo: 'vida', titulo: ev.titulo, cuerpo: `${txt} · ${horaDe(o.inicio)}${falta >= 1440 ? ' · ' + fechaLarga(o.dia) : ''}`, url: '#vida' });
    }
  }
  for (const d of dias) {
    if (av.resumen !== false) {
      const at = msDe(d, ajustes.resumen_hora || '08:00');
      if (en(at)) {
        const hoy = turnos.filter((t: any) => t.estado === 'reservado' && diaDe(t.inicio) === d).sort((a: any, b: any) => a.inicio - b.inicio);
        const mias = ocurrencias(eventos.filter((e: any) => e.tipo !== 'tarea'), d, d);
        const ses = hoy.length === 0 ? 'Hoy no tenés sesiones' : hoy.length === 1 ? 'Hoy tenés 1 sesión' : `Hoy tenés ${hoy.length} sesiones`;
        const lista = hoy.slice(0, 4).map((t: any) => `${horaDe(t.inicio)} ${primerNombre(nombreDe.get(t.paciente_id))}`).join(' · ');
        const extra = mias.length ? ` · ${mias.length} ${mias.length === 1 ? 'cosa tuya' : 'cosas tuyas'}` : '';
        const senas = hoy.filter((t: any) => t.sena !== 'confirmada').length;
        out.push({ clave: `resumen:${d}`, at, tipo: 'resumen', titulo: `Buen día, Agustina`, cuerpo: `${ses}${lista ? ': ' + lista : ''}${hoy.length > 4 ? '…' : ''}${extra}${senas ? ` · ${senas} ${senas === 1 ? 'seña' : 'señas'} sin confirmar` : ''}.`, url: '#hoy' });
      }
    }
    if (av.pendientes !== false) {
      const at = msDe(d, ajustes.pendientes_hora || '20:00');
      const pend = eventos.filter((e: any) => e.tipo === 'tarea' && !e.hecho && (!e.fecha || e.fecha <= d));
      if (en(at) && pend.length) {
        out.push({ clave: `pend:${d}`, at, tipo: 'pendientes', titulo: pend.length === 1 ? 'Te queda 1 cosa para hacer' : `Te quedan ${pend.length} cosas para hacer`, cuerpo: pend.slice(0, 3).map((e: any) => e.titulo).join(' · '), url: '#vida' });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at || (a.clave < b.clave ? -1 : 1));
}

// ---------------------------------------------------------------- Base (PostgREST con la service key)
function db(env: any) {
  const base = String(env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = (extra: any = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra });
  async function req(method: string, ruta: string, body?: any, extra: any = {}) {
    const r = await fetch(`${base}/rest/v1/${ruta}`, { method, headers: h(extra), body: body === undefined ? undefined : JSON.stringify(body) });
    const txt = await r.text();
    if (!r.ok) throw new Error(`${method} ${ruta.split('?')[0]}: ${r.status} ${txt.slice(0, 200)}`);
    return txt ? JSON.parse(txt) : null;
  }
  return {
    base, key,
    get: (ruta: string) => req('GET', ruta),
    post: (ruta: string, body: any, extra: any = {}) => req('POST', ruta, body, { Prefer: 'return=representation', ...extra }),
    patch: (ruta: string, body: any) => req('PATCH', ruta, body, { Prefer: 'return=minimal' }),
    del: (ruta: string) => req('DELETE', ruta, undefined, { Prefer: 'return=minimal' }),
  };
}
const ms = (t: any) => (t ? new Date(t).getTime() : null);

// Envío automático por WhatsApp Business (NO implementado: ver arriba). Devuelve true si lo mandó.
async function emisorWhatsAppAPI(_rec: any, _env: any): Promise<boolean> {
  return false;
}

// Arma los avisos programados que tocan y los mete en la cola (notificaciones). La clave evita repetidos.
export async function programar(env: any, now = Date.now()) {
  const D = db(env);
  const [ajustes] = await D.get('ajustes?id=eq.1&select=*');
  const desdeISO = new Date(now - DIA).toISOString(), hastaISO = new Date(now + 8 * DIA).toISOString();
  const turnos = (await D.get(`turnos?select=id,paciente_id,modalidad,inicio,fin,estado,sena,creado_at,agendado_at&estado=eq.reservado&inicio=gte.${desdeISO}&inicio=lte.${hastaISO}`))
    .map((t: any) => ({ ...t, inicio: ms(t.inicio), fin: ms(t.fin), creado_at: ms(t.creado_at), agendado_at: ms(t.agendado_at) }));
  const ids = [...new Set(turnos.map((t: any) => t.paciente_id))];
  const pacientes = ids.length ? await D.get(`pacientes?select=id,nombre&id=in.(${ids.join(',')})`) : [];
  const eventos = await D.get('eventos?select=*');
  const plan = planAvisos({ ajustes, turnos, pacientes, eventos }, now - VENTANA_MS, now);
  let nuevos = 0;
  for (const a of plan) {
    // on_conflict=clave + ignore-duplicates: si ya existe, no devuelve nada.
    const filas = await D.post('notificaciones?on_conflict=clave', { tipo: a.tipo, titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, clave: a.clave, turno_id: a.turno_id || null },
      { Prefer: 'return=representation,resolution=ignore-duplicates' });
    if (!filas || !filas.length) continue;
    nuevos++;
    if (a.tipo === 'recordatorio') {
      const t = turnos.find((x: any) => x.id === a.turno_id);
      const rec = { turno_id: a.turno_id, horas: a.horas, para: new Date(t.inicio).toISOString(), canal: ajustes.recordatorio_canal || 'whatsapp_manual' };
      await D.post('recordatorios?on_conflict=turno_id,horas,para', rec, { Prefer: 'return=minimal,resolution=ignore-duplicates' });
      if (rec.canal === 'whatsapp_api') {
        let ok = false;
        try { ok = await emisorWhatsAppAPI({ ...rec, turno: t }, env); } catch { ok = false; }
        if (ok) {
          await D.patch(`recordatorios?turno_id=eq.${a.turno_id}&horas=eq.${a.horas}&para=eq.${encodeURIComponent(rec.para)}`, { estado: 'enviado', enviado_at: new Date().toISOString(), detalle: 'automático' });
          await D.patch(`notificaciones?id=eq.${filas[0].id}`, { push: 'omitido', titulo: `Recordatorio enviado a ${a.titulo.replace('Recordale a ', '')}` });
        }
      }
    }
  }
  return nuevos;
}

const TIPO_AVISO: Record<string, string> = { reserva: 'reserva', cambio: 'cambio', comprobante: 'comprobante' };

// Manda por push lo que está pendiente en la cola.
export async function mandarCola(env: any) {
  const D = db(env);
  const [ajustes] = await D.get('ajustes?id=eq.1&select=avisos');
  const av = (ajustes && ajustes.avisos) || {};
  const desde = new Date(Date.now() - DIA).toISOString();
  const cola = await D.get(`notificaciones?select=id,tipo,titulo,cuerpo,url&push=eq.pendiente&creada_at=gte.${desde}&order=id.asc&limit=50`);
  if (!cola.length) return 0;
  const subs = await D.get('suscripciones?select=id,endpoint,p256dh,auth');
  let enviados = 0;
  for (const n of cola) {
    const apagado = TIPO_AVISO[n.tipo] && av[TIPO_AVISO[n.tipo]] === false;
    if (apagado || !subs.length || !env.VAPID_PUBLIC || !env.VAPID_PRIVATE) {
      await D.patch(`notificaciones?id=eq.${n.id}`, { push: 'omitido', push_at: new Date().toISOString() });
      continue;
    }
    let algun = false;
    for (const s of subs) {
      try {
        const st = await enviarPush(s, { title: n.titulo, body: n.cuerpo, tag: `${n.tipo}-${n.id}`, url: n.url || '' }, env);
        if (st === 404 || st === 410) await D.del(`suscripciones?id=eq.${s.id}`);
        else if (st < 300) algun = true;
      } catch { /* red: se marca igual para no repetir */ }
    }
    await D.patch(`notificaciones?id=eq.${n.id}`, { push: algun ? 'enviado' : 'error', push_at: new Date().toISOString() });
    if (algun) enviados++;
  }
  return enviados;
}

// URL firmada para subir el comprobante de UN turno (el token es el del link "mi turno").
const EXT_OK: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };
export async function urlSubida(env: any, token: string, tipo: string) {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(token || ''))) return { status: 400, error: 'Turno inválido' };
  const ext = EXT_OK[String(tipo || '')];
  if (!ext) return { status: 400, error: 'Subí una foto (JPG, PNG) o un PDF.' };
  const D = db(env);
  const [t] = await D.get(`turnos?select=id,estado&token=eq.${token}`);
  if (!t || t.estado !== 'reservado') return { status: 404, error: 'No encontramos ese turno.' };
  const nombre = `${t.id}/${b64u(crypto.getRandomValues(new Uint8Array(12)))}.${ext}`;
  const r = await fetch(`${D.base}/storage/v1/object/upload/sign/comprobantes/${nombre}`, { method: 'POST', headers: { apikey: D.key, Authorization: `Bearer ${D.key}`, 'Content-Type': 'application/json' }, body: '{}' });
  const d = await r.json().catch(() => ({}));
  const tk = d && d.url ? new URL(d.url, 'http://x').searchParams.get('token') : null;
  if (!r.ok || !tk) return { status: 502, error: 'No se pudo preparar la subida. Probá de nuevo.' };
  return { status: 200, path: nombre, token: tk };
}

async function esDuena(env: any, authHeader: string | null) {
  if (!authHeader) return false;
  const D = db(env);
  const r = await fetch(`${D.base}/auth/v1/user`, { headers: { apikey: D.key, Authorization: authHeader } });
  if (!r.ok) return false;
  const u = await r.json();
  const [d] = await D.get('duena?id=eq.1&select=usuario');
  return !!(u && d && u.id && u.id === d.usuario);
}

// ---------------------------------------------------------------- HTTP
export async function atender(req: Request, env: any): Promise<Response> {
  const origen = req.headers.get('Origin') || '';
  const permitidos = String(env.ORIGEN || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': !permitidos.length ? '*' : (permitidos.includes(origen) ? origen : permitidos[0]),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
  const json = (status: number, data: any) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido' });
  let d: any = {};
  try { d = await req.json(); } catch { return json(400, { error: 'JSON inválido' }); }
  try {
    if (d.accion === 'despachar') {
      const programados = await programar(env);
      const enviados = await mandarCola(env);
      return json(200, { ok: true, programados, enviados });
    }
    if (d.accion === 'subida') {
      const r: any = await urlSubida(env, d.token, d.tipo);
      return json(r.status, r);
    }
    if (d.accion === 'probar') {
      if (!(await esDuena(env, req.headers.get('Authorization')))) return json(403, { error: 'Solo Agustina.' });
      const D = db(env);
      await D.post('notificaciones', { tipo: 'prueba', titulo: 'Avisos activados', cuerpo: 'Así te van a llegar los avisos de tu agenda.', url: '#hoy' }, { Prefer: 'return=minimal' });
      const enviados = await mandarCola(env);
      return json(200, { ok: enviados > 0, enviados });
    }
    return json(404, { error: 'Acción desconocida' });
  } catch (e) {
    console.error(e);
    return json(500, { error: 'Error del servidor' });
  }
}

if (typeof Deno !== 'undefined' && Deno.serve) {
  Deno.serve((req: Request) => atender(req, Deno.env.toObject()));
}
