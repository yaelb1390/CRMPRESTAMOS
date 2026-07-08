'use client';

/**
 * Wrapper de fetch para llamadas al API interno (/api/*).
 * Si el servidor responde 401 (sesión inválida o expirada), redirige
 * automáticamente a /login en vez de dejar la pantalla colgada con
 * un error genérico.
 *
 * Uso: igual que fetch(url, options) — devuelve el mismo Response,
 * salvo en el caso 401 donde redirige y la promesa nunca resuelve
 * (la navegación reemplaza la página).
 */
export async function apiFetch(input, init) {
  const res = await fetch(input, init);

  if (res.status === 401 && typeof window !== 'undefined') {
    const alreadyOnLogin = window.location.pathname === '/login';
    if (!alreadyOnLogin) {
      window.location.href = '/login?expired=1';
      // No resolvemos con el response: la navegación ya está en marcha
      // y no queremos que el código que llamó siga leyendo datos vacíos.
      return new Promise(() => {});
    }
  }

  return res;
}
