'use client';

/**
 * Wrapper de fetch para llamadas al API interno (/api/*).
 * Si el servidor responde 401 (sesiÃ³n invÃ¡lida o expirada), redirige
 * automÃ¡ticamente a /login en vez de dejar la pantalla colgada con
 * un error genÃ©rico.
 *
 * Uso: igual que fetch(url, options) â€” devuelve el mismo Response,
 * salvo en el caso 401 donde redirige y la promesa nunca resuelve
 * (la navegaciÃ³n reemplaza la pÃ¡gina).
 */
export async function apiFetch(input, init) {
  const res = await fetch(input, init);

  if (res.status === 401 && typeof window !== 'undefined') {
    const alreadyOnLogin = window.location.pathname === '/login';
    if (!alreadyOnLogin) {
      window.location.href = '/login?expired=1';
      // No resolvemos con el response: la navegaciÃ³n ya estÃ¡ en marcha
      // y no queremos que el cÃ³digo que llamÃ³ siga leyendo datos vacÃ­os.
      return new Promise(() => {});
    }
  }

  return res;
}
