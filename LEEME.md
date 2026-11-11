# Mi agenda · Lic. Agustina Arrieta

App de turnos de Agustina (psicóloga). Tiene dos partes:

| Parte | Archivo | Quién la usa |
|---|---|---|
| **Panel "Mi agenda"** | `index.html` | Solo Agustina, con mail y contraseña. Se instala en su iPhone. |
| **Página de reservas** | `reservar.html` (también `index.html?r`) | Sus pacientes, sin cuenta. Ella les manda el link. |
| **"Mi turno"** | `reservar.html?t=CÓDIGO` | El paciente ve su turno, lo cambia si faltan más de 24 h o escribe para cancelar. |

- **Sin claves en `config.js`** arranca en **modo demo**: datos inventados que viven en ese navegador. Arriba aparece una barra amarilla "DEMO".
- **Con claves** usa la base real en Supabase, a nombre de Agustina.

Todo es de Agustina: la cuenta de la base, su usuario, los avisos y su WhatsApp. El código y la publicación van en el GitHub de Gabriel.

## Probar la demo en la compu

```
node herramientas/servidor.mjs
```

Abrí `http://localhost:8790/` para el panel (tocá **Entrar**) o `http://localhost:8790/reservar.html` para la página de pacientes.

En la barra DEMO de la página de pacientes:
- **Turno en unos días** abre un turno que se puede cambiar.
- **Turno en 5 h** abre uno que ya no se puede cambiar.

---

## Salir en vivo

Son unos 30 minutos. Cada paso dice quién lo hace:
- **[G/A]**: Gabriel o Agustina. Necesita entrar con la cuenta de ella.
- **[asistente]**: lo hace Claude en esta carpeta.

### 1. Crear el proyecto en Supabase [G/A]

1. Entrá a [supabase.com](https://supabase.com) y tocá **Start your project**.
2. Registrate con el Gmail de Agustina: **lic.agustina.arrieta@gmail.com**.
   - Puede ser con "Continue with Google" o con mail y contraseña.
   - Supabase no pide tarjeta.
3. Si pide crear una organización, ponele **Agustina Arrieta**, tipo Personal, plan **Free**.
4. Tocá **New project**:
   - Nombre: `agenda-agustina`.
   - Database password: generá una y **guardala** (en el gestor de contraseñas de ella).
   - Region: **South America (São Paulo)**.
5. Esperá unos 2 minutos a que termine de crearse.

### 2. Cargar la base [G/A]

1. En el menú de la izquierda andá a **SQL Editor** y tocá **New query**.
2. Copiá **todo** `supabase/schema.sql`, pegalo y tocá **Run**. Tiene que decir *Success*.
3. *(Opcional)* Para ver el panel con datos de prueba, corré también `supabase/seed.sql`. Al final de ese archivo están las 2 líneas que los borran.

### 3. Crear el usuario de Agustina [G/A]

1. Andá a **Authentication** y después a **Sign In / Providers** (o **Providers**).
   - En **Email**, apagá **Allow new users to sign up**. Así nadie más puede crearse una cuenta.
2. Andá a **Authentication**, después a **Users**, y tocá **Add user** → **Create new user**:
   - Mail: `lic.agustina.arrieta@gmail.com`.
   - Contraseña: la que elija ella.
   - Tildá **Auto Confirm User**.
3. Volvé al **SQL Editor** y corré esto. La deja como dueña de la agenda: sin este paso, el panel no muestra nada.
   ```sql
   update public.duena set usuario = (select id from auth.users where email = 'lic.agustina.arrieta@gmail.com') where id = 1;
   ```

### 4. Claves de los avisos [asistente → G/A]

1. **[asistente]** Corre `node herramientas/generar-vapid.mjs` y te pasa tres valores.
2. **[G/A]** En Supabase andá a **Edge Functions** y después a **Secrets**. Cargá:

   | Nombre | Valor |
   |---|---|
   | `VAPID_PUBLIC` | el que empieza con `B…` |
   | `VAPID_PRIVATE` | el otro. **Es secreto**: no va en ningún otro lado. |
   | `VAPID_SUBJECT` | `mailto:lic.agustina.arrieta@gmail.com` |
   | `ORIGEN` *(opcional)* | `https://masterpadel360.github.io` |

### 5. Publicar la función "avisos" [G/A]

Se hace desde el navegador, sin instalar nada.

1. Andá a **Edge Functions** y tocá **Deploy a new function** → **Via Editor**.
2. Nombre: `avisos` (exacto).
3. Borrá el código de ejemplo. Pegá **todo** `supabase/functions/avisos/index.ts` y tocá **Deploy**.
4. Entrá a la función, después a **Details** / **Settings**. Apagá **Verify JWT** (puede decir *Enforce JWT verification*) y guardá.
   - La función se cuida sola: para subir un comprobante pide el código secreto del turno, y la prueba de avisos pide la sesión de Agustina.
5. **[asistente]** Completa `supabase/cron.sql` con el código del proyecto y la anon key.
6. **[G/A]** Corré ese `cron.sql` en el SQL Editor. Desde ahí, cada 5 minutos se mandan:
   - los recordatorios,
   - el resumen de las 8:00,
   - los avisos de Mi vida.

### 6. Conectar la app [G/A → asistente]

1. **[G/A]** Andá a **Project Settings** y después a **API** (o **API Keys**). Copiá:
   - **Project URL**
   - la clave **anon** / **publishable**

   y pasáselas al asistente.
   - **Nunca** copies la `service_role` ni la `secret`.
2. **[asistente]** Las pega en `config.js` junto con `vapidPublic`, sube la versión de `sw.js` y hace el commit.
3. **[G/A]** Andá a **Authentication**, después a **URL Configuration**. En **Site URL** poné la dirección del paso 7.

### 7. Publicar en GitHub Pages [G]

1. En GitHub (cuenta de Gabriel) creá un repositorio **público** llamado `agenda-agustina`.
2. Subí el contenido de esta carpeta.
   - El asistente puede hacer el push si lo autorizás.
   - La carpeta `capturas/` no hace falta.
3. Andá a **Settings** → **Pages** → **Deploy from a branch**. Elegí `main` y `/ (root)`.
4. En un minuto queda publicada:
   - **Panel:** `https://masterpadel360.github.io/agenda-agustina/`
   - **Link para pacientes:** `https://masterpadel360.github.io/agenda-agustina/reservar.html`

### 8. Instalarla en el iPhone de Agustina [A]

1. Abrí el link del **panel** con **Safari**. Tiene que ser Safari, no Chrome.
2. Tocá **Compartir** (el cuadrado con la flecha) → **Agregar a inicio** → **Agregar**. Aparece el ícono de la S en zigzag.
3. **Abrí la app desde ese ícono.** Los avisos solo funcionan así, en iOS 16.4 o más nuevo.
4. Entrá con tu mail y tu contraseña.
5. Andá a **Ajustes** → **Avisos al celu** → **Activar** → **Permitir**.
6. Tocá **Probar**: tiene que llegar "Avisos activados".
7. En **Ajustes**, completá:
   - **Servicio y seña:** tu WhatsApp, el link de la videollamada, la seña y el alias.
   - **Horarios:** presencial y virtual.
   - **Recordatorio a pacientes:** cuántas horas antes te aviso, el mensaje y la imagen.

### 9. Compartir el link de reservas [A]

En **Ajustes**, en "Mi link de reservas":
- **WhatsApp** lo comparte directo.
- **Copiar** lo copia para pegarlo donde quieras: en el perfil de WhatsApp Business, en Instagram, etc.

---

## Cómo funciona

**Reserva (paciente)**
1. Elige presencial o virtual, día y horario. Solo ve los horarios libres, nunca nombres.
2. Completa sus datos.
3. Lee las reglas, copia el alias y transfiere la seña.
4. Sube la foto del comprobante.
5. Le queda el link "Mi turno".

**Reglas del turno**
- **El horario se guarda mientras reserva.** Son 10 minutos y se renuevan en cada paso. Se libera si vuelve atrás o cierra la página.
- **Una persona por horario.** La base no deja que dos turnos se pisen, aunque sean de distinta modalidad.
- **Edad.** Menores de 15 no pueden reservar. De 15 a 17 se pide un adulto responsable.
- **Cambios.** Solo si faltan más de 24 h. Lo controla la base, no la pantalla.
- **Cancelar.** Solo hablando con Agustina, con el botón de WhatsApp.

**Comprobantes**
- Se guardan en un espacio privado.
- Solo se suben con un permiso de un solo uso, atado al turno.
- Solo los ve Agustina.

**Avisos al celu de Agustina**
- Al instante: cuando alguien reserva, cambia un turno o sube un comprobante.
- Recordatorios de Mi vida.
- Resumen del día a las 8:00.
- Cosas pendientes a las 20:00.

**Recordatorio a pacientes**
1. X horas antes de cada sesión le llega a Agustina "Recordale a Martina: mañana 18:00". Las horas las elige ella.
2. Lo toca y se abre la imagen ya armada (la plantilla con el día y la hora escritos sobre las líneas) y el mensaje.
3. **Mandar por WhatsApp** abre el menú de compartir con la imagen y el texto. El texto también queda copiado, por si WhatsApp no lo pega.
4. Si el celu no puede compartir archivos, se usan **Abrir su chat** y **Guardar imagen**.

**Recordatorio 100% automático** (para más adelante, es pago)
- Requiere la API de WhatsApp Business de Meta: pago por mensaje y una plantilla aprobada.
- La parte para conectarlo está marcada en `supabase/functions/avisos/index.ts` (`emisorWhatsAppAPI`).
- Después se activa poniendo `ajustes.recordatorio_canal = 'whatsapp_api'`.
- Si el envío automático falla, vuelve solo al modo de un toque.

**Plan gratis de Supabase**
- Si un proyecto no tiene actividad en una semana, Supabase lo puede pausar.
- El cron cada 5 minutos lo mantiene activo.
- Si igual llega un mail de pausa, entrá y tocá **Restore**.

## Cambiar el logo o la plantilla del recordatorio

- **Logo de la app:** `logo/logo.svg` es el logo RESET trazado del original (`logo/logo-reset-original.jpeg`).
- **Ícono del celu:**
  1. Cambiá `logo/icono.svg`.
  2. Corré `node herramientas/generar-iconos.mjs`.
  3. Subí la versión de `sw.js`.
- **Plantilla del recordatorio:**
  - La que viene con la app es `recordatorio/plantilla-recordatorio.jpeg`.
  - Agustina puede subir otra desde **Ajustes** → **Recordatorio a pacientes** y acomodar la altura de las líneas y el tamaño de la letra.

## Pruebas

```
node tests/logica.test.mjs     # horarios por modalidad, bloqueos, Mi vida, edad, regla de 24 h, avisos
node tests/push.test.mjs       # cifrado Web Push (vector del RFC 8291), VAPID, función = app
node tests/demo.test.mjs       # reglas de la base en la capa demo (retención, edad, 24 h, comprobante)
node tests/navegador.mjs       # Chrome sin ventana a 390 px: reserva completa, cambios, panel, recordatorio
```

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html`, `js/panel.js` | Panel de Agustina |
| `reservar.html`, `js/reservar.js` | Página de reservas y "Mi turno" |
| `js/logica.js` | Reglas: grilla de horarios, edad, 24 h, avisos programados, plantillas |
| `js/datos-demo.js`, `js/datos-supabase.js` | Capa de datos (demo o real, misma interfaz) |
| `js/imagen-recordatorio.js` | Arma la imagen del recordatorio en el celu |
| `js/sprite.js` | Personajes e íconos (generado desde la maqueta C1 con `herramientas/armar-sprite.mjs`) |
| `supabase/schema.sql` | Tablas, seguridad (RLS), funciones y archivos |
| `supabase/functions/avisos/index.ts` | Avisos push, recordatorios, URL de subida |
| `supabase/cron.sql` | Reloj de cada 5 minutos |
| `sw.js`, `manifest.json`, `iconos/` | App instalable y avisos |
