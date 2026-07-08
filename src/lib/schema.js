import { query } from './db.js';

/**
 * "Self-healing" de columnas de la tabla `clientes`.
 *
 * Antes este mismo bloque DDL estaba duplicado en `clientes/route.js` y
 * `clientes/[cedula]/route.js`. Centralizado aquí (fuente única). No lanza:
 * si falla, lo registra y continúa, para no romper el flujo principal.
 *
 * Nota: idealmente esto vive en las migraciones y no en el hot-path de las
 * rutas; se mantiene como red de seguridad hasta consolidar las migraciones.
 */
export async function ensureClientesColumns() {
  try {
    await query(`
      ALTER TABLE clientes
      ADD COLUMN IF NOT EXISTS metodo_desembolso VARCHAR(20) DEFAULT 'efectivo',
      ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(100),
      ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(50),
      ADD COLUMN IF NOT EXISTS email VARCHAR(150)
    `);
  } catch (err) {
    console.error('Error ensuring columns:', err);
  }
}
