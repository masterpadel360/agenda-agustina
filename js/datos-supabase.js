// =====================================================================
// Capa de datos REAL (Supabase). Misma interfaz que datos-demo.js.
// Pacientes: solo funciones (RPC) de schema.sql, que validan todo.
// Agustina: lee y escribe sus tablas (las reglas RLS solo la dejan a ella).
// =====================================================================
import { achicarImagen } from './ui.js';

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const ms = (t) => (t ? new Date(t).getTime() : null);
const iso = (m) => new Date(m).toISOString();
// Solo convierte '' en null en los campos que vienen (así un cambio parcial no borra lo demás).
const vacioANull = (o, ks) => { const x = { ...o }; for (const k of ks) if (k in x && !x[k]) x[k] = null; return x; };
const hm = (t) => (t ? String(t).slice(0, 5) : null);

function limpiar(msg) {
  const m = String(msg || 'Algo salió mal.');
  if (/Invalid login credentials/i.test(m)) return 'Mail o contraseña incorrectos.';
  if (/rate limit/i.test(m)) return 'Muchos intentos seguidos. Esperá un minuto.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Probá de nuevo.';
  if (/turnos_sin_superposicion|exclusion/i.test(m)) return 'Ese horario ya tiene otro turno.';
  if (/JWT|permission denied|row-level security/i.test(m)) return 'Tu sesión venció. Entrá de nuevo.';
  return m;
}

export async function crearSupabase(cfg) {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(limpiar(error.message)); return data; };
  const rpc = async (fn, args) => ok(await sb.rpc(fn, args));
  let delta = 0; // diferencia entre el reloj del celu y el del servidor
  const ahora = () => Date.now() + delta;
  const funcion = `${cfg.supabaseUrl.replace(/\/+$/, '')}/functions/v1/avisos`;
  async function llamarFuncion(body, conSesion = false) {
    const headers = { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey };
    if (conSesion) { const { data } = await sb.auth.getSession(); if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`; }
    const r = await fetch(funcion, { method: 'POST', headers, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo conectar con el servidor.');
    return d;
  }
  const ev = (e) => ({ ...e, hora_inicio: hm(e.hora_inicio), hora_fin: hm(e.hora_fin) });
  const tu = (t) => ({ ...t, inicio: ms(t.inicio), fin: ms(t.fin), creado_at: ms(t.creado_at), agendado_at: ms(t.agendado_at), comprobante_at: ms(t.comprobante_at) });

  const publico = {
    async info() { const d = await rpc('publico_info'); delta = d.ahora - Date.now(); return d; },
    ocupado: (desdeDia, hastaDia, ret) => rpc('publico_ocupado', { p_desde: desdeDia, p_hasta: hastaDia, p_retencion: ret || null }).then((r) => r.map((x) => ({ inicio: Number(x.inicio), fin: Number(x.fin) }))),
    retener: (mod, inicio, tk) => rpc('retener', { p_mod: mod, p_inicio: inicio, p_token: tk || null }),
    soltar: (tk) => rpc('soltar', { p_token: tk }),
    // Al cerrar la página: pedido que sobrevive al cierre (keepalive).
    soltarAlSalir(tk) {
      try {
        fetch(`${cfg.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/soltar`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` }, body: JSON.stringify({ p_token: tk }) });
      } catch { /* */ }
    },
    reservar: (ret, d) => rpc('reservar', { p_retencion: ret, p_datos: d }),
    miTurno: async (tk) => { const d = await rpc('mi_turno', { p_token: tk }); delta = d.ahora - Date.now(); return d; },
    cambiarTurno: (tk, ret) => rpc('cambiar_turno', { p_token: tk, p_retencion: ret }),
    async subirComprobante(tk, file) {
      const f = await achicarImagen(file);
      if (f.size > 8 * 1048576) throw new Error('El archivo es muy pesado (máximo 8 MB).');
      const u = await llamarFuncion({ accion: 'subida', token: tk, tipo: f.type });
      ok(await sb.storage.from('comprobantes').uploadToSignedUrl(u.path, u.token, f, { contentType: f.type }));
      await rpc('registrar_comprobante', { p_token: tk, p_path: u.path });
      return u.path;
    },
    despachar() { llamarFuncion({ accion: 'despachar' }).catch(() => { /* el cron lo manda igual */ }); },
  };

  const tabla = (n) => sb.from(n);
  async function upsert(n, obj) {
    if (obj.id) return ok(await tabla(n).update(obj).eq('id', obj.id).select().single());
    const { id, ...resto } = obj;
    return ok(await tabla(n).insert(resto).select().single());
  }

  const panel = {
    async sesion() { const { data } = await sb.auth.getSession(); return data.session ? { email: data.session.user.email } : null; },
    onSesion(cb) { sb.auth.onAuthStateChange((e) => { if (e === 'SIGNED_OUT') cb(); }); },
    async entrar(email, clave) { ok(await sb.auth.signInWithPassword({ email, password: clave })); return true; },
    async salir() { await sb.auth.signOut(); return true; },
    async cargar() {
      const desde = new Date(Date.now() - 400 * 86400e3).toISOString();
      const [ajustes, modalidades, servicios, bloqueos, pacientes, turnos, historial, eventos, notificaciones, recordatorios] = await Promise.all([
        tabla('ajustes').select('*').eq('id', 1).single().then(ok),
        tabla('modalidades').select('*').order('orden').then(ok),
        tabla('servicios').select('*').order('orden').order('id').then(ok),
        tabla('bloqueos').select('*').order('desde').then(ok),
        tabla('pacientes').select('*').order('nombre').then(ok),
        tabla('turnos').select('*').gte('inicio', desde).order('inicio').then(ok),
        tabla('historial').select('*').gte('at', desde).order('at').then(ok),
        tabla('eventos').select('*').order('fecha', { nullsFirst: true }).then(ok),
        tabla('notificaciones').select('id,tipo,titulo,cuerpo,url,turno_id,creada_at,leida').order('id', { ascending: false }).limit(100).then(ok),
        tabla('recordatorios').select('*').order('id', { ascending: false }).limit(200).then(ok),
      ]);
      return {
        ajustes, modalidades, servicios, bloqueos, pacientes,
        turnos: turnos.map(tu),
        historial: historial.map((h) => ({ ...h, at: ms(h.at) })),
        eventos: eventos.map(ev),
        notificaciones: notificaciones.map((n) => ({ ...n, creada_at: ms(n.creada_at) })),
        recordatorios: recordatorios.map((r) => ({ ...r, para: ms(r.para), creado_at: ms(r.creado_at), enviado_at: ms(r.enviado_at) })),
        ahora: Date.now(),
      };
    },
    async guardarAjustes(p) { ok(await tabla('ajustes').update({ ...p, actualizado_at: new Date().toISOString() }).eq('id', 1)); return true; },
    async guardarModalidad(m) { ok(await tabla('modalidades').update(m).eq('id', m.id)); return true; },
    guardarServicio: (x) => upsert('servicios', x),
    async borrarServicio(id) { ok(await tabla('servicios').update({ activo: false }).eq('id', id)); return true; },
    guardarBloqueo: (b) => upsert('bloqueos', { ...b, hasta: b.hasta || b.desde }),
    async borrarBloqueo(id) { ok(await tabla('bloqueos').delete().eq('id', id)); return true; },
    guardarPaciente: (p) => upsert('pacientes', vacioANull(p, ['nacimiento'])),
    async borrarPaciente(id) { ok(await tabla('pacientes').delete().eq('id', id)); return true; },
    async crearTurno({ paciente_id, servicio_id, modalidad, inicio, duracion, sena }) { return tu(await rpc('duena_crear_turno', { p_paciente: paciente_id, p_servicio: servicio_id || null, p_mod: modalidad, p_inicio: inicio, p_duracion: duracion || null, p_sena: sena || 'pendiente' })); },
    async moverTurno(id, inicio, modalidad) { return tu(await rpc('duena_mover_turno', { p_id: id, p_inicio: inicio, p_mod: modalidad || null })); },
    cancelarTurno: (id, motivo) => rpc('duena_cancelar_turno', { p_id: id, p_motivo: motivo || '' }),
    senaTurno: (id, estado) => rpc('duena_sena', { p_id: id, p_estado: estado }),
    async urlComprobante(path) { return ok(await sb.storage.from('comprobantes').createSignedUrl(path, 3600)).signedUrl; },
    guardarEvento: (e) => upsert('eventos', vacioANull(e, ['fecha', 'hora_inicio', 'hora_fin'])).then(ev),
    async borrarEvento(id) { ok(await tabla('eventos').delete().eq('id', id)); return true; },
    async marcarRecordatorio(id, estado = 'enviado') { ok(await tabla('recordatorios').update({ estado, enviado_at: new Date().toISOString() }).eq('id', id)); return true; },
    async leerNotificaciones() { ok(await tabla('notificaciones').update({ leida: true }).eq('leida', false)); return true; },
    async suscribirPush(sub) {
      const j = sub.toJSON ? sub.toJSON() : sub;
      ok(await tabla('suscripciones').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, equipo: navigator.userAgent.slice(0, 120) }, { onConflict: 'endpoint' }));
      return true;
    },
    probarPush: () => llamarFuncion({ accion: 'probar' }, true),
    async subirPlantilla(file) {
      const f = await achicarImagen(file, 2000, 0.9);
      const path = `plantilla-${Date.now()}.${f.type === 'image/png' ? 'png' : 'jpg'}`;
      ok(await sb.storage.from('imagenes').upload(path, f, { contentType: f.type, upsert: true }));
      await panel.guardarAjustes({ recordatorio_imagen: path });
      return path;
    },
    async urlPlantilla(path) { return ok(await sb.storage.from('imagenes').createSignedUrl(path, 3600)).signedUrl; },
    tick() { /* lo hace la función "avisos" con el cron */ },
  };

  return { modo: 'supabase', ahora, publico, panel, demo: null };
}
