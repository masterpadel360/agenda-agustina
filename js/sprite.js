// Generado por herramientas/armar-sprite.mjs desde la maqueta aprobada (C1). No editar a mano.
// 6 personajes propios (alegría, tristeza, enojo, miedo, desagrado, ansiedad) + íconos de línea.
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="grain" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="7" result="t"/>
    <feColorMatrix in="t" type="saturate" values="0" result="g"/>
    <feComponentTransfer in="g" result="gl"><feFuncR type="linear" slope=".45" intercept=".62"/><feFuncG type="linear" slope=".45" intercept=".62"/><feFuncB type="linear" slope=".45" intercept=".62"/></feComponentTransfer>
    <feBlend in="SourceGraphic" in2="gl" mode="multiply" result="b"/>
    <feComposite in="b" in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter>
  <filter id="softer" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
  <radialGradient id="g-pipa" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#FFF6A8"/><stop offset=".55" stop-color="#FFD60A"/><stop offset="1" stop-color="#F0A500"/></radialGradient>
  <radialGradient id="g-lulo" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#B8DCFF"/><stop offset=".55" stop-color="#2F8CF5"/><stop offset="1" stop-color="#1452C4"/></radialGradient>
  <radialGradient id="g-toto" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#FFB0A6"/><stop offset=".55" stop-color="#F23A2E"/><stop offset="1" stop-color="#BE1616"/></radialGradient>
  <radialGradient id="g-nina" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#D8C0FF"/><stop offset=".55" stop-color="#8A4BF2"/><stop offset="1" stop-color="#5A1FC8"/></radialGradient>
  <radialGradient id="g-bru" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#C6F6CF"/><stop offset=".55" stop-color="#2CC253"/><stop offset="1" stop-color="#15873A"/></radialGradient>
  <radialGradient id="g-leaf" cx="30%" cy="30%" r="90%"><stop offset="0" stop-color="#D7EEDC"/><stop offset="1" stop-color="#86BC98"/></radialGradient>
  <radialGradient id="g-steam" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCD3E6"/></radialGradient>
  <symbol id="emo-alegria" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="30" ry="4.5" fill="#5A3F6A" opacity=".10" filter="url(#soft)"/>
    <path d="M22 76q-12-6-12-18M98 76q12-6 12-18" stroke="#FFCF1F" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M60 32c25 0 41 18 41 42 0 23-18 37-41 37S19 97 19 74c0-24 16-42 41-42z" fill="url(#g-pipa)"/>
    <path d="M60 33c0-11 6-18 16-20-1 11-7 18-16 20z" fill="url(#g-leaf)"/>
    <path d="M60 33c-1-8-7-13-15-13 1 8 7 13 15 13z" fill="url(#g-leaf)"/>
    <ellipse cx="45" cy="52" rx="12" ry="7" fill="#fff" opacity=".45" filter="url(#softer)"/>
    <circle cx="51" cy="71" r="2.8" fill="#4A3656"/><circle cx="69" cy="71" r="2.8" fill="#4A3656"/>
    <path d="M54 80q6 5.5 12 0" stroke="#4A3656" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="40" cy="80" rx="7" ry="4.5" fill="#F27F8C" opacity=".55" filter="url(#soft)"/>
    <ellipse cx="80" cy="80" rx="7" ry="4.5" fill="#F27F8C" opacity=".55" filter="url(#soft)"/>
  </symbol>
  <symbol id="emo-tristeza" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="28" ry="4.5" fill="#5A3F6A" opacity=".10" filter="url(#soft)"/>
    <path d="M60 12C73 36 97 52 97 78a37 33 0 0 1-74 0c0-26 24-42 37-66z" fill="url(#g-lulo)"/>
    <ellipse cx="47" cy="58" rx="9" ry="12" fill="#fff" opacity=".4" filter="url(#softer)"/>
    <path d="M45 72l8-3M75 72l-8-3" stroke="#4A3656" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="51" cy="78" r="2.8" fill="#4A3656"/><circle cx="69" cy="78" r="2.8" fill="#4A3656"/>
    <path d="M55 90q5-3.5 10 0" stroke="#4A3656" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M73 83c2 3 3 5 3 6.5a3 3 0 0 1-6 0c0-1.5 1-3.5 3-6.5z" fill="#A9CBF0"/>
    <ellipse cx="40" cy="87" rx="6.5" ry="4" fill="#E58FB2" opacity=".45" filter="url(#soft)"/>
    <ellipse cx="80" cy="87" rx="6.5" ry="4" fill="#E58FB2" opacity=".45" filter="url(#soft)"/>
  </symbol>
  <symbol id="emo-enojo" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="34" ry="4.5" fill="#5A3F6A" opacity=".10" filter="url(#soft)"/>
    <circle cx="47" cy="24" r="7" fill="url(#g-steam)"/>
    <circle cx="57" cy="14" r="5.5" fill="url(#g-steam)"/>
    <circle cx="72" cy="22" r="8" fill="url(#g-steam)"/>
    <path d="M60 38c27 0 43 17 43 40 0 21-17 31-43 31S17 99 17 78c0-23 16-40 43-40z" fill="url(#g-toto)"/>
    <ellipse cx="42" cy="54" rx="13" ry="7" fill="#fff" opacity=".45" filter="url(#softer)"/>
    <path d="M42 66l10 4M78 66l-10 4" stroke="#4A3656" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="50" cy="76" r="2.8" fill="#4A3656"/><circle cx="70" cy="76" r="2.8" fill="#4A3656"/>
    <path d="M53 90h14" stroke="#4A3656" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="37" cy="85" rx="7" ry="4.5" fill="#C93A3A" opacity=".3" filter="url(#soft)"/>
    <ellipse cx="83" cy="85" rx="7" ry="4.5" fill="#C93A3A" opacity=".3" filter="url(#soft)"/>
  </symbol>
  <symbol id="emo-miedo" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="32" ry="4.5" fill="#5A3F6A" opacity=".10" filter="url(#soft)"/>
    <path d="M24 46q-5 7 0 14M17 50q-3 3 0 6M96 46q5 7 0 14M103 50q3 3 0 6" stroke="#7A3FE6" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="60" cy="70" rx="36" ry="41" fill="#fff" opacity=".75" filter="url(#softer)"/>
    <ellipse cx="60" cy="70" rx="31" ry="36" fill="url(#g-nina)" stroke="#fff" stroke-width="2.5"/>
    <ellipse cx="48" cy="48" rx="10" ry="8" fill="#fff" opacity=".45" filter="url(#softer)"/>
    <path d="M44 53l8-3M76 53l-8-3" stroke="#4A3656" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="50" cy="64" r="6" fill="#fff"/><circle cx="70" cy="64" r="6" fill="#fff"/>
    <circle cx="50.5" cy="65.5" r="2.6" fill="#4A3656"/><circle cx="70.5" cy="65.5" r="2.6" fill="#4A3656"/>
    <ellipse cx="40" cy="73" rx="5.5" ry="3.5" fill="#E2729A" opacity=".4" filter="url(#soft)"/>
    <ellipse cx="80" cy="73" rx="5.5" ry="3.5" fill="#E2729A" opacity=".4" filter="url(#soft)"/>
    <path d="M18 86c12-7 26-8 42-5s30 2 42-4c3 9 2 18-2 24-14 7-66 7-80 0-4-5-5-10-2-15z" fill="url(#g-steam)"/>
    <path d="M30 93q8-3 16 0M70 92q8-3 16 0" stroke="#CDBFE0" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="44" cy="84" r="5.5" fill="#7A3FE6" stroke="#fff" stroke-width="1.5"/><circle cx="76" cy="84" r="5.5" fill="#7A3FE6" stroke="#fff" stroke-width="1.5"/>
  </symbol>
  <symbol id="emo-desagrado" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="36" ry="4.5" fill="#5A3F6A" opacity=".10" filter="url(#soft)"/>
    <path d="M30 104c-11 0-18-8-18-18 0-9 6-16 14-17 0-12 10-22 22-22 6-10 16-14 26-12 13 2 22 14 21 26 8 2 13 10 13 18 0 14-10 25-23 25z" fill="url(#g-bru)"/>
    <ellipse cx="50" cy="56" rx="13" ry="7" fill="#fff" opacity=".45" filter="url(#softer)"/>
    <path d="M44 70h10M66 70h10" stroke="#4A3656" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="49" cy="74" r="2.6" fill="#4A3656"/><circle cx="71" cy="74" r="2.6" fill="#4A3656"/>
    <path d="M52 87q4-3 8 0t8 0" stroke="#4A3656" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M60 89c0 4 2 6 4 6s3-2 3-5" fill="#F5A3B0"/>
    <ellipse cx="38" cy="82" rx="6.5" ry="4" fill="#E58FB2" opacity=".4" filter="url(#soft)"/>
    <ellipse cx="82" cy="82" rx="6.5" ry="4" fill="#E58FB2" opacity=".4" filter="url(#soft)"/>
  </symbol>
  <radialGradient id="g-tembi" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#FFD3A6"/><stop offset=".55" stop-color="#FF8A1C"/><stop offset="1" stop-color="#DD5A00"/></radialGradient>
  <symbol id="emo-ansiedad" viewBox="0 0 120 120">
    <ellipse cx="60" cy="112" rx="28" ry="4.5" fill="#5A3F6A" opacity=".10" filter="url(#soft)"/>
    <path d="M17 60q-5 7 0 14M10 63q-3 4 0 8M103 60q5 7 0 14M110 63q3 4 0 8" stroke="#FF8A1C" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path d="M60.0 35.0Q68.6 32.5 75.2 38.5Q84.0 39.9 87.4 48.2Q94.7 53.3 94.1 62.2Q98.5 70.0 94.1 77.8Q94.7 86.7 87.4 91.8Q84.0 100.1 75.2 101.5Q68.6 107.5 60.0 105.0Q51.4 107.5 44.8 101.5Q36.0 100.1 32.6 91.8Q25.3 86.7 25.9 77.8Q21.5 70.0 25.9 62.2Q25.3 53.3 32.6 48.2Q36.0 39.9 44.8 38.5Q51.4 32.5 60.0 35.0z" fill="url(#g-tembi)"/>
    <ellipse cx="46" cy="52" rx="11" ry="7" fill="#fff" opacity=".45" filter="url(#softer)"/>
    <path d="M43 57l8-4M77 57l-8-4" stroke="#4A3656" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="50" cy="66" r="6.5" fill="#fff"/><circle cx="70" cy="66" r="6.5" fill="#fff"/>
    <circle cx="52" cy="65" r="2.4" fill="#4A3656"/><circle cx="72" cy="65" r="2.4" fill="#4A3656"/>
    <path d="M51 81q4.5-3 9 0t9 0" stroke="#4A3656" stroke-width="2.3" fill="none" stroke-linecap="round"/>
    <rect x="57.5" y="80.5" width="5" height="4" rx="1.2" fill="#fff"/>
    <path d="M33 84q13 13 25 5M87 84q-13 13-25 5" stroke="#C94E00" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M93 34c2.4 3.4 3.6 5.6 3.6 7.2a3.6 3.6 0 0 1-7.2 0c0-1.6 1.2-3.8 3.6-7.2z" fill="#A9D3F5"/>
    <ellipse cx="39" cy="75" rx="6" ry="4" fill="#C2461A" opacity=".3" filter="url(#soft)"/>
    <ellipse cx="81" cy="75" rx="6" ry="4" fill="#C2461A" opacity=".3" filter="url(#soft)"/>
  </symbol>
  <symbol id="wave" viewBox="0 0 360 40" preserveAspectRatio="none"><path d="M0 22C60 4 120 6 180 20s120 18 180-2V40H0z" fill="#FFFFFF"/></symbol>
    <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.3-7-11.5A7 7 0 0 1 19 9.5C19 14.7 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
    <symbol id="i-video" viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 10.5l5-3v9l-5-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
    <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.8c2 .7 3.2 2.4 3.5 5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="i-gear" viewBox="0 0 24 24"><path d="M10.3 2.5h3.4l.5 2.4a7.5 7.5 0 0 1 1.9 1.1l2.3-.8 1.7 2.9-1.8 1.6a7.6 7.6 0 0 1 0 2.2l1.8 1.6-1.7 2.9-2.3-.8a7.5 7.5 0 0 1-1.9 1.1l-.5 2.4h-3.4l-.5-2.4a7.5 7.5 0 0 1-1.9-1.1l-2.3.8-1.7-2.9 1.8-1.6a7.6 7.6 0 0 1 0-2.2L3.9 8.1l1.7-2.9 2.3.8a7.5 7.5 0 0 1 1.9-1.1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20.5v-5h4v5" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
    <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 5.5A2.5 2.5 0 0 0 13.5 4H6.5A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 5.5 16" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M4.5 15.5v2A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
    <symbol id="i-chat" viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 0 0-7.4 12.7L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 9.2c.3 2.6 2.4 5 5.6 5.7l1-1.4-1.9-.9-.8.8c-1-.4-2-1.4-2.4-2.4l.8-.8-.9-1.9z" fill="currentColor"/></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24"><path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3A2 2 0 0 1 17.5 18.5 14 14 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
    <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
    <symbol id="i-chev" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-back" viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="i-ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 18L18 6" stroke="currentColor" stroke-width="1.8"/></symbol>
    <symbol id="i-edit" viewBox="0 0 24 24"><path d="M4.5 19.5l1-4L15 6a2.1 2.1 0 0 1 3 3l-9.5 9.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
    <symbol id="i-swap" viewBox="0 0 24 24"><path d="M5 8.5h13l-3.5-3.5M19 15.5H6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.2" fill="currentColor"/></symbol>
    <symbol id="i-receipt" viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8.5h6M9 12h6M9 15.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
    <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11z" fill="currentColor"/></symbol>
    <symbol id="arrow-curve" viewBox="0 0 60 40"><path d="M4 6c10 2 28 6 40 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M36 27l8 4 1-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h5a1.5 1.5 0 0 0 1.5-1.5L17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-share" viewBox="0 0 24 24"><path d="M12 15V4M8 7.5 12 3.5l4 4M6 11H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 11h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 17v1A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-image" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 17.5l5-4.5 3.5 3 3-2.5 4.5 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
    <symbol id="i-logout" viewBox="0 0 24 24"><path d="M14 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h7M10 12h10M16.5 8.5 20 12l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
    <symbol id="i-list" viewBox="0 0 24 24"><path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="5" cy="7" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="17" r="1.2" fill="currentColor"/></symbol></defs></svg>`;
