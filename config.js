// =====================================================================
// Configuración. Es lo único que hay que tocar para salir en vivo (ver LEEME.md).
// - supabaseUrl / supabaseAnonKey: Supabase → Project Settings → API
//   (Project URL y la clave "anon" / "publishable"). Si quedan vacías,
//   la app arranca en MODO DEMO con datos inventados.
// - vapidPublic: la clave pública de avisos (node herramientas/generar-vapid.mjs).
// La anon key es pública por diseño: la seguridad está en las reglas de
// supabase/schema.sql. NUNCA pegues acá la "service_role" / "secret" key.
// =====================================================================
window.AGUSTINA_CONFIG = {
  supabaseUrl: 'https://jmmdbhhbyycjpficzrob.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptbWRiaGhieXljanBmaWN6cm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNTgxNTcsImV4cCI6MjEwOTkzNDE1N30.6-cvFtjj3D9lXIYr7hGuFCbCFzlBT5SH_hJ_339hmno',
  vapidPublic: 'BGBTGQ-zSVQx6c5DlZQ9WnE1hHGWB5iZhsri9UDaZWMp0xLqUfZk-JxYyy87XAEsKcvGeQk7hxsGcX6A6JwERIA',
};
