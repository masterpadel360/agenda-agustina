// =====================================================================
// Página de reservas (pacientes, sin cuenta).
// Pasos: inicio → modalidad → día y horario → datos → reglas y seña → comprobante → listo.
// "Mi turno": reservar.html?t=TOKEN (ver, cambiar si faltan más de 24 h, cancelar por WhatsApp).
// El horario elegido queda guardado unos minutos (retención) y se libera al volver o al cerrar.
// =====================================================================
import * as L from './logica.js';
import { esc, ico, emo, hero, grupo6, toast, copiar, ponerSprite, kb } from './ui.js';
import { crearCapaDatos } from './datos.js';

const $app = document.getElementById('app');
const st = {
  paso: 'cargando', info: null, servicio: null, modalidad: null, dia: null, slot: null, ret: null,
  ocupados: [], datos: { primera_vez: null }, reserva: null, archivo: null, subiendo: false, error: '',
  modo: 'nueva', token: null, turno: null, acepto: false,
};
let D, P;

const fmtDia = (ms) => L.fechaLarga(L.diaDe(ms), true);
const fmtLimite = (ms) => `${L.fechaCorta(L.diaDe(ms))}, ${L.horaDe(ms)}`;
const mod = (id) => (st.info.modalidades || []).find((m) => m.id === id);
const modsActivas = () => (st.info.modalidades || []).filter((m) => m.activa && Object.values(m.horario || {}).some((r) => r.length));
const waCancelar = (t) => L.linkWa(st.info.whatsapp, t ? `Hola Agustina, soy ${t.nombre}. Necesito hablar por mi turno del ${L.fechaLarga(L.diaDe(t.inicio))} a las ${L.horaDe(t.inicio)}.` : 'Hola Agustina, te escribo por un turno.');
const linkMiTurno = (tk) => `${location.origin}${location.pathname}?t=${encodeURIComponent(tk)}`;

function volverBtn(txt = 'Volver') { return `<button class="pillbtn" data-acc="volver">${ico('back')}${txt}</button>`; }
const pasoTxt = (n) => `<span class="caps muted">Paso ${n} de 5</span>`;

function reglasHtml(info) {
  return `<div class="card" style="padding:6px 16px">
    <div class="regla sm"><span class="n" style="background:var(--peach1);color:#B4592A">1</span><span class="g"><b>La seña no se devuelve nunca.</b></span></div>
    <div class="regla sm"><span class="n" style="background:var(--lav1);color:#6E58B0">2</span><span class="g"><b>Podés cambiar el turno hasta ${info.horas_cambio} h antes.</b> Después, ya no.</span></div>
    <div class="regla sm"><span class="n" style="background:#E3F3E8;color:var(--ok)">3</span><span class="g"><b>Para cancelar, escribile a Agustina</b> por WhatsApp. Desde acá no se puede cancelar.</span></div>
  </div>`;
}

// ---------------------------------------------------------------- pantallas
const P_ = {};
P_.cargando = () => `<div class="body center" style="padding-top:120px">${emo('alegria', 120)}<p class="muted">Cargando…</p></div>`;
P_.error = () => `${hero({ clase: 'lav', ancho: true, titulo: 'Uy, algo falló', sub: esc(st.error), personaje: 'tristeza' })}
  <div class="body"><button class="cta" data-acc="reintentar">Probar de nuevo</button></div>`;

P_.inicio = () => {
  const i = st.info;
  const servs = i.servicios || [];
  const durs = [...new Set(modsActivas().map((m) => m.duracion))].sort((a, b) => a - b);
  const dur = durs.length > 1 ? `${durs[0]}–${durs[durs.length - 1]}` : String(durs[0] || 50);
  return `<header class="hero peach grainy ancho" style="text-align:center;padding-bottom:64px">
      <div class="logo-wrap">
        <img class="logo" src="logo/logo.svg" alt="RESET" width="150" height="54">
        <div class="logo-sub">Compañía Psicológica</div>
        <div class="sig" style="margin-top:12px"><div class="nm">${esc(i.nombre)}</div><div class="pr">${esc(i.profesion)}</div></div>
        ${grupo6()}
      </div>${olaSvg()}
    </header>
    <div class="body">
      ${servs.map((s) => `<div class="card" style="margin-top:-6px">
        <div class="Q b" style="font-size:18px">${esc(s.nombre)}</div><div class="muted xs">${esc(s.detalle)}</div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:14px;gap:10px">
          <div><span class="num">${dur}</span> <span class="muted sm">min</span></div>
          <div style="text-align:right"><span class="muted sm">$</span> <span class="num">${L.precio(s.precio)}</span></div>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">${modsActivas().map((m) => `<span class="tag ${m.id === 'virtual' ? 'sky' : 'lav'}">${ico(m.id === 'virtual' ? 'video' : 'pin')}${m.id === 'virtual' ? 'Virtual' : 'Presencial'}</span>`).join('')}</div>
      </div>`).join('')}
      <button class="cta" data-acc="empezar" ${modsActivas().length ? '' : 'disabled'}>Reservar un turno ${ico('chev')}</button>
      <button class="cta white" style="margin-top:10px" data-acc="yatengo">Ya tengo turno</button>
      <div id="yatengo" class="card flat sm hidden" style="margin-top:12px">Abrí el link <b>“Ver mi turno”</b> que te quedó al reservar. ¿No lo encontrás? <a href="${waCancelar(null)}" target="_blank" rel="noopener"><b>Escribile a Agustina</b></a>.</div>
      <div class="caps muted" style="margin:22px 6px 8px">Antes de reservar</div>
      ${reglasHtml(i)}
      <p class="sm muted center" style="margin:16px 0 0">Todas las emociones tienen lugar acá.</p>
      <p class="hand center" style="font-size:21px;margin:10px 0 0">${esc(i.lema)} <svg class="heart"><use href="#i-heart"/></svg></p>
      <p class="xs muted center" style="margin:14px 0 0">${esc(i.nombre)} · ${esc(i.matricula || '')}</p>
    </div>`;
};
const olaSvg = () => '<svg class="wave" viewBox="0 0 360 40" preserveAspectRatio="none" aria-hidden="true"><use href="#wave"/></svg>';

P_.modalidad = () => {
  const servs = st.info.servicios || [];
  return `${hero({ clase: 'lav', arriba: `<div class="toprow">${volverBtn()}${pasoTxt(1)}</div>`, titulo: '¿Cómo preferís la sesión?', personaje: 'miedo', tam: 118 })}
    <div class="body">
      ${servs.length > 1 ? `<div class="caps muted" style="margin:0 6px 8px">Servicio</div><div class="seg">${servs.map((s) => `<button data-acc="servicio" data-id="${s.id}" class="${st.servicio === s.id ? 'on' : ''}">${esc(s.nombre)}</button>`).join('')}</div>` : ''}
      ${modsActivas().map((m) => {
        const on = st.modalidad === m.id, v = m.id === 'virtual';
        return `<button class="card" data-acc="modalidad" data-id="${m.id}" style="display:block;width:100%;text-align:left;border:0;cursor:pointer;${on ? 'box-shadow:0 0 0 2.5px var(--orange),var(--shadow)' : ''}">
          <div style="display:flex;gap:12px;align-items:center">
            <span class="ic ${v ? 'sky' : 'lav'}">${ico(v ? 'video' : 'pin')}</span>
            <div style="flex:1"><div class="Q b" style="font-size:18px">${v ? 'Virtual' : 'Presencial'}</div><div class="muted xs">${esc(m.detalle)} · ${m.duracion} min</div></div>
            ${on ? `<span class="ic" style="width:28px;height:28px;background:var(--orange);color:#fff">${ico('check', '', 'width:15px;height:15px')}</span>` : '<span style="width:28px;height:28px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--line)"></span>'}
          </div>
          <div class="sm" style="margin-top:12px;background:${on ? 'var(--peach-soft)' : 'var(--soft)'};border-radius:18px;padding:9px 13px">${esc(L.textoHorario(m))}</div>
        </button>`;
      }).join('')}
      <p class="hand" style="font-size:21px;margin:4px 6px 0">¿Primera vez? Tranqui, después se puede cambiar.</p>
      <button class="cta" data-acc="seguir-modalidad" ${st.modalidad ? '' : 'disabled'}>Seguir</button>
    </div>`;
};

function argsSlots() {
  return { mod: mod(st.modalidad), ahora: D.ahora(), bloqueos: st.info.bloqueos, ocupados: st.ocupados, anticipacionHoras: st.info.anticipacion_horas, horizonteDias: st.info.horizonte_dias };
}
P_.dia = () => {
  const m = mod(st.modalidad);
  const hoy = L.diaDe(D.ahora());
  const dias = L.diasDisponibles(argsSlots(), hoy, Math.min(st.info.horizonte_dias + 1, 62));
  if (!st.dia || !dias.some((d) => d.dia === st.dia && d.libres)) st.dia = (dias.find((d) => d.libres) || {}).dia || null;
  const libres = st.dia ? L.slotsLibres({ ...argsSlots(), dia: st.dia }) : [];
  const cambio = st.modo === 'cambio';
  const mes = st.dia ? `${L.MESES_LARGOS[Number(st.dia.slice(5, 7)) - 1]}` : '';
  return `${hero({ clase: 'mix', arriba: `<div class="toprow">${volverBtn()}<span class="tag">${st.modalidad === 'virtual' ? 'Virtual' : 'Presencial'}</span></div>`, titulo: cambio ? 'Elegí el nuevo día' : 'Elegí el día', sub: st.dia ? `${L.fechaLarga(st.dia, true).split(' ')[0]} · ${mes}` : '', personaje: 'alegria', tam: 104, estilo: 'padding-bottom:52px' })}
    <div class="body">
      <div class="days" id="days">${dias.map((d) => `<button data-acc="dia" data-dia="${d.dia}" class="${d.dia === st.dia ? 'on' : d.libres ? 'open' : ''}" ${d.libres ? '' : 'disabled'} aria-label="${L.fechaLarga(d.dia)}${d.libres ? '' : ' sin lugar'}"><small>${L.DIAS_CORTOS[L.diaSemana(d.dia)]}</small>${Number(d.dia.slice(8))}</button>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin:6px 2px 10px;gap:8px"><span class="Q b">Horarios libres</span><span class="hand" style="font-size:19px">${st.dia ? esc(L.fechaLarga(st.dia)) : ''}</span></div>
      ${!st.dia ? `<div class="vacio">${emo('tristeza', 110)}<h3>No hay lugar por ahora</h3><p class="sm muted">Probá con la otra modalidad o escribile a Agustina.</p></div>`
        : `<div class="slots">${libres.map((s) => `<button class="slot ${st.slot && st.slot.inicio === s.inicio ? 'on' : ''}" data-acc="slot" data-ini="${s.inicio}">${s.hora}</button>`).join('')}</div>`}
      ${st.slot ? `<div class="card flat sm" style="margin-top:14px;display:flex;gap:10px;align-items:center">${ico('clock', '', 'color:var(--orange)')}${esc(L.fechaCorta(L.diaDe(st.slot.inicio), true))} · ${L.horaDe(st.slot.inicio)} a ${L.horaDe(st.slot.fin)} · ${m.duracion} min</div>` : ''}
      ${st.error ? `<div class="err">${esc(st.error)}</div>` : ''}
      <button class="cta" data-acc="seguir-dia" ${st.slot ? '' : 'disabled'}>${cambio ? 'Confirmar el cambio' : 'Seguir'}</button>
      ${cambio ? '<p class="xs muted center" style="margin:10px 0 0">No pagás otra seña.</p>' : ''}
    </div>`;
};

const retencionTxt = () => (st.ret ? `<div class="cuenta">${ico('lock')}Te guardamos este horario hasta las ${L.horaDe(st.ret.expira)}.</div>` : '');

P_.datos = () => {
  const d = st.datos;
  const regla = d.nacimiento ? L.reglaEdad(d.nacimiento, L.diaDe(D.ahora())) : null;
  const ed = d.nacimiento ? L.edad(d.nacimiento, L.diaDe(D.ahora())) : null;
  return `${hero({ clase: 'lav', arriba: `<div class="toprow">${volverBtn()}${pasoTxt(3)}</div>`, titulo: 'Contanos quién sos', personaje: 'tristeza', tam: 96, estilo: 'padding-bottom:52px' })}
    <div class="body" id="form">
      <label class="inp"><small>Nombre y apellido</small><input data-k="nombre" autocomplete="name" value="${esc(d.nombre || '')}" maxlength="80"></label>
      <div class="fila2">
        <label class="inp"><small>WhatsApp</small><input data-k="telefono" type="tel" inputmode="tel" autocomplete="tel" value="${esc(d.telefono || '')}" maxlength="30" placeholder="351 555-0000"></label>
        <label class="inp"><small>Nacimiento</small><input data-k="nacimiento" type="date" value="${esc(d.nacimiento || '')}" max="${L.diaDe(D.ahora())}"></label>
      </div>
      <label class="inp"><small>Email · opcional</small><input data-k="email" type="email" autocomplete="email" value="${esc(d.email || '')}" maxlength="120"></label>
      <div class="seg" role="group" aria-label="¿Primera vez?"><button data-acc="primera" data-v="1" class="${d.primera_vez === true ? 'on' : ''}">Primera vez</button><button data-acc="primera" data-v="0" class="${d.primera_vez === false ? 'on' : ''}">Ya vengo</button></div>
      ${regla === 'menor' ? `<div class="card mal" style="display:flex;gap:10px;align-items:center">${emo('miedo', 56, 'flex:none')}<div class="sm"><b>La atención es desde los 15 años.</b><br>Si es para un/a menor de 15, escribile a Agustina y lo charlan.</div></div>` : ''}
      ${regla === 'responsable' ? `<div class="card aviso" style="margin-bottom:10px">
        <div class="Q b sm" style="color:var(--warn);margin-bottom:6px">Tenés ${ed}: sumá un adulto responsable</div>
        <label class="inp" style="background:#fff"><small>Nombre del adulto (y vínculo)</small><input data-k="responsable_nombre" value="${esc(d.responsable_nombre || '')}" maxlength="80" placeholder="Laura Méndez (mamá)"></label>
        <label class="inp" style="background:#fff;margin:0"><small>Teléfono del adulto</small><input data-k="responsable_telefono" type="tel" inputmode="tel" value="${esc(d.responsable_telefono || '')}" maxlength="30"></label>
      </div>` : ''}
      <label class="inp" style="margin-bottom:4px"><small>Motivo · opcional</small><textarea data-k="motivo" maxlength="600" placeholder="Contalo en pocas palabras, si querés…">${esc(d.motivo || '')}</textarea></label>
      <div class="xs muted" style="display:flex;gap:5px;align-items:center;margin-left:6px">${ico('lock', '', 'width:14px;height:14px')}Privado: solo lo lee Agustina.</div>
      ${st.error ? `<div class="err">${esc(st.error)}</div>` : ''}
      <button class="cta" data-acc="seguir-datos" ${regla === 'menor' ? 'disabled' : ''}>Seguir</button>
      ${retencionTxt()}
    </div>`;
};

P_.reglas = () => {
  const i = st.info;
  return `${hero({ clase: 'peach', arriba: `<div class="toprow">${volverBtn()}${pasoTxt(4)}</div>`, titulo: 'Antes de confirmar', sub: `${esc(fmtDia(st.slot.inicio))} · ${L.horaDe(st.slot.inicio)} · ${st.modalidad === 'virtual' ? 'Virtual' : 'Presencial'}`, personaje: 'enojo', tam: 100, estilo: 'padding-bottom:52px' })}
    <div class="body">
      ${reglasHtml(i)}
      <button class="li sm" data-acc="acepto" style="margin:0 0 12px;padding:4px 6px"><span class="chk ${st.acepto ? 'done' : ''}">${st.acepto ? ico('check') : ''}</span><span class="g">Leí y acepto las reglas</span></button>
      <div class="card grainy" style="background:linear-gradient(150deg,var(--lav1),#DCD0F5);box-shadow:none"><div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:8px"><span class="caps" style="color:#6E58B0">Seña</span><span><span class="muted sm">$</span> <span class="num" style="font-size:36px">${L.precio(i.sena)}</span></span></div>
        <div class="xs muted" style="margin:2px 0 10px">Transferí a este alias · titular ${esc(i.titular)}</div>
        <div class="copybox"><span class="v" id="alias">${esc(i.alias)}</span><button class="btn-oscuro" data-acc="copiar-alias">${ico('copy')}<span id="copiar-txt">Copiar</span></button></div>
      </div></div>
      ${st.error ? `<div class="err">${esc(st.error)}</div>` : ''}
      <button class="cta" style="margin-top:0" data-acc="transferi" ${st.acepto ? '' : 'disabled'}>Ya transferí</button>
      ${retencionTxt()}
    </div>`;
};

P_.comprobante = () => {
  const a = st.archivo;
  return `${hero({ clase: 'lav', arriba: `<div class="toprow"><span></span>${pasoTxt(5)}</div>`, titulo: 'Subí el comprobante', sub: 'Tu turno ya está reservado.', personaje: 'desagrado', tam: 104, estilo: 'padding-bottom:52px' })}
    <div class="body">
      <label class="subir">
        <input type="file" id="archivo" accept="image/*,application/pdf">
        <span class="circ" style="margin:0 auto 10px;color:#6E58B0">${ico('upload')}</span>
        <div class="Q b" style="font-size:17px">${a ? 'Elegir otra foto' : 'Tocá para elegir la foto'}</div>
        <div class="muted sm">Captura o PDF de la transferencia</div>
      </label>
      ${a ? `<div class="card" style="display:flex;gap:12px;align-items:center">
        <span class="ic sky" style="width:46px;height:56px;border-radius:14px">${ico('receipt')}</span>
        <div style="flex:1;min-width:0"><div class="b sm wrapword">${esc(a.nombre)}</div><div class="xs muted">${kb(a.tam)}</div></div>
        ${st.subiendo ? '<span class="tag honey">Subiendo…</span>' : a.ok ? `<span class="tag mint">${ico('check')}Subido</span>` : '<span class="tag rojo">Falló</span>'}
      </div>` : ''}
      <p class="sm muted" style="margin:0 6px">Agustina revisa la seña y te confirma por WhatsApp.</p>
      ${st.error ? `<div class="err">${esc(st.error)}</div>` : ''}
      <button class="cta" data-acc="confirmar" ${a && a.ok && !st.subiendo ? '' : 'disabled'}>Confirmar reserva</button>
      <button class="cta white" style="margin-top:10px" data-acc="despues">Lo subo más tarde</button>
    </div>`;
};

function tarjetaTurno(t) {
  const senaTag = t.estado === 'cancelado' ? '<span class="tag rojo">Cancelado</span>'
    : t.sena === 'confirmada' ? `<span class="tag mint">${ico('check')}Seña confirmada</span>`
    : t.comprobante ? '<span class="tag honey">Seña en revisión</span>' : '<span class="tag honey">Falta el comprobante</span>';
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="caps muted">${esc(fmtDia(t.inicio))}</span><span class="tag ${t.modalidad === 'virtual' ? 'sky' : 'lav'}">${t.modalidad === 'virtual' ? 'Virtual' : 'Presencial'}</span></div>
    <div class="num" style="margin:8px 0 4px">${L.horaDe(t.inicio)}</div>
    <div class="muted sm">${esc(t.servicio)} · ${Math.round((t.fin - t.inicio) / 60000)} min${t.detalle ? ` · ${esc(t.detalle)}` : ''}</div>
    <div style="margin-top:10px">${senaTag}</div>
  </div>`;
}

P_.listo = () => {
  const t = st.turno;
  return `<header class="hero mix grainy ancho" style="text-align:center;padding-bottom:60px"><div>
      <div style="display:flex;justify-content:center;align-items:flex-end;margin-top:6px">${emo('miedo', 66)}${emo('alegria', 146)}${emo('enojo', 66)}</div>
      <h1 style="font-size:30px;margin-top:6px">¡Listo, ${esc(t.nombre)}! <svg class="heart" style="width:22px;height:22px"><use href="#i-heart"/></svg></h1>
      <p class="sub">Tu turno quedó reservado.</p><p class="hand" style="font-size:22px;margin:6px 0 0">¡nos vemos pronto!</p>
    </div>${olaSvg()}</header>
    <div class="body">
      ${tarjetaTurno(t)}
      ${t.link_videollamada ? `<a class="cta white" style="margin:0 0 14px" href="${esc(t.link_videollamada)}" target="_blank" rel="noopener">${ico('video')}Link de la videollamada</a>` : ''}
      <p class="xs" style="margin:0 6px">La seña no se devuelve · cambios hasta el <b>${esc(fmtLimite(t.limite_cambio))}</b> · para cancelar, escribile a Agustina.</p>
      <div class="card flat" style="margin-top:14px">
        <div class="caps muted">Guardá tu link</div>
        <div class="sm" style="margin:4px 0 10px">Con este link ves tu turno y lo podés cambiar.</div>
        <div class="copybox" style="background:#fff"><span class="v sm" style="font-size:13px">${esc(linkMiTurno(st.token))}</span><button class="btn-oscuro" data-acc="copiar-link">${ico('copy')}Copiar</button></div>
      </div>
      ${!t.comprobante ? `<button class="cta white" data-acc="ir-comprobante">${ico('upload')}Subir el comprobante</button>` : ''}
      <a class="cta" href="${esc(linkMiTurno(st.token))}">Ver o cambiar mi turno</a>
      <a class="cta wa" style="margin-top:10px" href="${waCancelar(t)}" target="_blank" rel="noopener">${ico('chat')}Cancelar por WhatsApp</a>
    </div>`;
};

P_.miturno = () => {
  const t = st.turno;
  const v = t.modalidad === 'virtual';
  const cancelado = t.estado === 'cancelado';
  const pasado = t.fin < D.ahora();
  return `${hero({ clase: 'lav', arriba: `<div class="toprow"><span class="tag">Mi turno</span><span class="tag ${v ? 'sky' : 'lav'}">${v ? 'Virtual' : 'Presencial'}</span></div>
      <div class="caps muted" style="margin-top:16px">${esc(fmtDia(t.inicio))}</div><div class="num" style="font-size:54px;margin-top:4px">${L.horaDe(t.inicio)}</div>`, personaje: cancelado ? 'tristeza' : 'alegria', tam: 110, estilo: 'padding-bottom:56px' })}
    <div class="body">
      <div class="card" style="padding:6px 16px">
        <div class="li sm" style="cursor:default"><span class="ic s ${cancelado ? 'peach' : t.sena === 'confirmada' ? 'mint' : 'honey'}">${ico(cancelado ? 'ban' : t.sena === 'confirmada' ? 'check' : 'receipt')}</span><span class="g">${cancelado ? 'Este turno está cancelado' : t.sena === 'confirmada' ? 'Seña confirmada' : t.comprobante ? 'Seña en revisión' : 'Falta subir el comprobante'}</span></div>
        <div class="li sm" style="cursor:default"><span class="ic s lav">${ico('heart')}</span><span class="g">${esc(t.servicio)} · ${Math.round((t.fin - t.inicio) / 60000)} min${t.detalle ? `<br><span class="xs muted">${esc(t.detalle)}</span>` : ''}</span></div>
        ${t.link_videollamada && !pasado ? `<a class="li sm" href="${esc(t.link_videollamada)}" target="_blank" rel="noopener"><span class="ic s sky">${ico('video')}</span><span class="g"><b>Entrar a la videollamada</b></span>${ico('chev', 'muted')}</a>` : ''}
      </div>
      ${!cancelado && !t.comprobante && t.sena !== 'confirmada' && !pasado ? `<div class="card aviso"><div class="sm"><b>Seña: $ ${L.precio(t.sena_monto)}</b> al alias <b>${esc(t.alias)}</b></div><button class="cta chico white" style="margin-top:10px" data-acc="ir-comprobante">${ico('upload')}Subir el comprobante</button></div>` : ''}
      ${cancelado || pasado ? '' : t.puede_cambiar
        ? `<p class="sm" style="margin:0 6px">Podés cambiarlo hasta el <b>${esc(fmtLimite(t.limite_cambio))}</b>.</p>
           <button class="cta" data-acc="cambiar">${ico('swap')}Cambiar día u horario</button>`
        : `<div class="card flat" style="display:flex;gap:10px;align-items:center;background:#FCEFCF">${emo('enojo', 58, 'flex:none')}
             <div class="sm"><span class="caps" style="color:var(--warn)">Faltan menos de ${t.horas_cambio} h</span><br><b>Ya no se puede cambiar.</b> Si no podés venir, escribile a Agustina.</div></div>`}
      <a class="cta wa" style="margin-top:10px" href="${waCancelar(t)}" target="_blank" rel="noopener">${ico('chat')}${cancelado ? 'Escribirle a Agustina' : 'Cancelar por WhatsApp'}</a>
      <p class="xs muted center" style="margin:14px 0 0">La seña no se devuelve. Para cancelar, hablá con Agustina.</p>
    </div>`;
};

// ---------------------------------------------------------------- render y acciones
function render() {
  document.querySelector('.demo-bar')?.remove();
  $app.innerHTML = (P_[st.paso] || P_.cargando)();
  if (D && D.modo === 'demo') {
    const b = document.createElement('div');
    b.className = 'demo-bar';
    b.innerHTML = `DEMO · datos inventados <a href="?t=${D.demo.tokens.lejos}">Turno en unos días</a><a href="?t=${D.demo.tokens.cerca}">Turno en 5 h</a><a href="index.html">Panel</a>`;
    $app.prepend(b);
  }
  const days = document.getElementById('days');
  if (days) { const on = days.querySelector('.on'); if (on) days.scrollLeft = on.offsetLeft - 40; }
  const f = document.getElementById('archivo');
  if (f) f.addEventListener('change', subir);
}
function ir(paso, empujar = true) {
  st.paso = paso; st.error = '';
  if (empujar) history.pushState({ paso }, '');
  render();
  window.scrollTo(0, 0);
}
const ORDEN = ['inicio', 'modalidad', 'dia', 'datos', 'reglas'];

async function cargarOcupados() {
  const hoy = L.diaDe(D.ahora());
  st.ocupados = await P.ocupado(hoy, L.sumarDias(hoy, Math.min(st.info.horizonte_dias + 1, 62)), st.ret ? st.ret.token : null);
}

async function soltarRetencion() {
  if (st.ret) { const tk = st.ret.token; st.ret = null; try { await P.soltar(tk); } catch { /* vence sola */ } }
}

async function volver() {
  st.error = '';
  if (st.modo === 'cambio' && st.paso === 'dia') { await soltarRetencion(); st.slot = null; return ir('miturno', false); }
  const i = ORDEN.indexOf(st.paso);
  if (st.paso === 'dia') { await soltarRetencion(); st.slot = null; }
  if (i > 0) ir(ORDEN[i - 1], false);
}

async function conCarga(btn, fn) {
  const t = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Un momento…'; }
  try { await fn(); }
  catch (e) { st.error = e.message || 'Algo salió mal.'; render(); }
  finally { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = t; } }
}

function leerDatos() {
  document.querySelectorAll('#form [data-k]').forEach((el) => { st.datos[el.dataset.k] = el.value.trim(); });
}

async function subir(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  st.archivo = { nombre: file.name || 'comprobante', tam: file.size, ok: false };
  st.subiendo = true; st.error = ''; render();
  try { await P.subirComprobante(st.token, file); st.archivo.ok = true; P.despachar(); }
  catch (er) { st.error = er.message || 'No se pudo subir. Probá de nuevo.'; }
  st.subiendo = false; render();
}

async function abrirTurno(tk) {
  st.token = tk;
  st.turno = await P.miTurno(tk);
}

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-acc]');
  if (!b) return;
  const a = b.dataset.acc;
  if (a === 'volver') return volver();
  if (a === 'reintentar') return location.reload();
  if (a === 'yatengo') return document.getElementById('yatengo').classList.toggle('hidden');
  if (a === 'empezar') {
    st.modo = 'nueva';
    if (!st.servicio) st.servicio = (st.info.servicios[0] || {}).id || null;
    if (!st.modalidad && modsActivas().length === 1) st.modalidad = modsActivas()[0].id;
    return ir('modalidad');
  }
  if (a === 'servicio') { st.servicio = Number(b.dataset.id); return render(); }
  if (a === 'modalidad') { st.modalidad = b.dataset.id; st.slot = null; st.dia = null; return render(); }
  if (a === 'seguir-modalidad') return conCarga(b, async () => { await cargarOcupados(); ir('dia'); });
  if (a === 'dia') { st.dia = b.dataset.dia; st.slot = null; return render(); }
  if (a === 'slot') { const ini = Number(b.dataset.ini); st.slot = L.slotsLibres({ ...argsSlots(), dia: st.dia }).find((s) => s.inicio === ini) || null; st.error = ''; return render(); }
  if (a === 'seguir-dia') {
    return conCarga(b, async () => {
      try { st.ret = await P.retener(st.modalidad, st.slot.inicio, st.ret ? st.ret.token : null); }
      catch (e) { st.slot = null; await cargarOcupados(); throw e; }
      if (st.modo === 'cambio') {
        await P.cambiarTurno(st.token, st.ret.token);
        st.ret = null; st.slot = null; st.modo = 'nueva';
        P.despachar();
        await abrirTurno(st.token);
        ir('miturno', false);
        toast('Listo, tu turno cambió.');
        return;
      }
      ir('datos');
    });
  }
  if (a === 'primera') { leerDatos(); st.datos.primera_vez = b.dataset.v === '1'; return render(); }
  if (a === 'seguir-datos') {
    leerDatos();
    const regla = L.reglaEdad(st.datos.nacimiento, L.diaDe(D.ahora()));
    if (regla !== 'responsable') { st.datos.responsable_nombre = ''; st.datos.responsable_telefono = ''; }
    const p = L.validarDatos(st.datos, L.diaDe(D.ahora()));
    if (p) { st.error = p; return render(); }
    return conCarga(b, async () => { st.ret = await P.retener(st.modalidad, st.slot.inicio, st.ret.token); ir('reglas'); });
  }
  if (a === 'acepto') { st.acepto = !st.acepto; return render(); }
  if (a === 'copiar-alias') {
    const ok = await copiar(st.info.alias);
    const t = document.getElementById('copiar-txt'); if (t) t.textContent = ok ? 'Copiado' : 'Copialo a mano';
    return toast(ok ? 'Alias copiado' : 'No se pudo copiar: copialo a mano');
  }
  if (a === 'transferi') {
    return conCarga(b, async () => {
      const r = await P.reservar(st.ret.token, { ...st.datos, servicio_id: st.servicio });
      st.ret = null; st.token = r.token;
      try { sessionStorage.setItem('agustina-ultimo-turno', r.token); } catch { /* */ }
      P.despachar();
      ir('comprobante', false);
    });
  }
  if (a === 'confirmar' || a === 'despues') {
    return conCarga(b, async () => { await abrirTurno(st.token); history.replaceState({ paso: 'listo' }, '', `?t=${encodeURIComponent(st.token)}&listo=1`); ir('listo', false); });
  }
  if (a === 'copiar-link') { const ok = await copiar(linkMiTurno(st.token)); return toast(ok ? 'Link copiado' : 'No se pudo copiar'); }
  if (a === 'ir-comprobante') { st.archivo = null; return ir('comprobante'); }
  if (a === 'cambiar') {
    return conCarga(b, async () => {
      st.modo = 'cambio'; st.modalidad = st.turno.modalidad; st.slot = null; st.dia = null;
      await cargarOcupados();
      ir('dia');
    });
  }
});

// Atrás del celu = "Volver"
window.addEventListener('popstate', () => { if (['modalidad', 'dia', 'datos', 'reglas'].includes(st.paso)) volver(); else if (st.paso === 'comprobante' && st.turno) ir('miturno', false); });
// Si cierra la página, el horario guardado se libera enseguida (no hay que esperar a que venza).
window.addEventListener('pagehide', () => { if (st.ret) P.soltarAlSalir(st.ret.token); });

async function iniciar() {
  ponerSprite();
  render();
  try {
    D = await crearCapaDatos(window.AGUSTINA_CONFIG);
    P = D.publico;
    st.info = await P.info();
    const q = new URLSearchParams(location.search);
    const tk = q.get('t');
    if (tk) {
      await abrirTurno(tk);
      st.paso = q.get('listo') ? 'listo' : 'miturno';
    } else st.paso = 'inicio';
    history.replaceState({ paso: st.paso }, '');
  } catch (e) {
    st.error = e.message || 'No pudimos cargar la página.';
    st.paso = 'error';
  }
  render();
}
iniciar();
// Al corregir un dato, se va el cartel de error.
document.addEventListener('input', () => { if (st.error) { st.error = ''; document.querySelectorAll('.err').forEach((e) => e.remove()); } });
