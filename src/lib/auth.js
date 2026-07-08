import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

function getSecretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no está definido en las variables de entorno.');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Extrae y verifica el usuario autenticado desde la cookie auth_token.
 * @returns {Promise<{id, username, rol, nombre} | null>}
 */
export async function getCurrentUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch {
    return null;
  }
}

/**
 * Requiere autenticación. Devuelve 401 si no hay sesión válida.
 * @returns {Promise<{user, errorResponse}>}
 */
export async function requireAuth(request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'No autorizado. Debe iniciar sesión.' },
        { status: 401 }
      ),
    };
  }
  return { user, errorResponse: null };
}

/**
 * Requiere que el usuario sea administrador. Devuelve 401/403 si no lo es.
 * @returns {Promise<{user, errorResponse}>}
 */
export async function requireAdmin(request) {
  const { user, errorResponse } = await requireAuth(request);
  if (errorResponse) return { user: null, errorResponse };
  if (user.rol !== 'admin') {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Acceso denegado. Solo administradores.' },
        { status: 403 }
      ),
    };
  }
  return { user, errorResponse: null };
}

/**
 * Retorna la IP del cliente desde los headers de la request.
 */
export function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export { getSecretKey };
