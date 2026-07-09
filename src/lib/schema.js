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

/**
 * Datos de la empresa para el encabezado de la factura/recibo.
 * Se siembran como claves de `configuracion_financiera` (INSERT idempotente) para
 * que aparezcan y se editen desde el módulo de Configuración existente, sin tocar su UI.
 * Los recibos los leen vía `GET /api/configuracion/empresa`.
 */
export const EMPRESA_DEFAULTS = [
  { clave: 'empresa_nombre', valor: 'Préstamos BM', descripcion: 'Nombre de la empresa (factura)' },
  { clave: 'empresa_rnc', valor: '', descripcion: 'RNC / cédula de la empresa (factura)' },
  { clave: 'empresa_direccion', valor: 'Santo Domingo, Rep. Dom.', descripcion: 'Dirección de la empresa (factura)' },
  { clave: 'empresa_telefono', valor: '', descripcion: 'Teléfono de la empresa (factura)' },
];

export async function ensureEmpresaConfig() {
  try {
    for (const row of EMPRESA_DEFAULTS) {
      await query(
        `INSERT INTO configuracion_financiera (clave, valor, descripcion)
         VALUES ($1, $2, $3)
         ON CONFLICT (clave) DO NOTHING`,
        [row.clave, row.valor, row.descripcion]
      );
    }
  } catch (err) {
    console.error('Error ensuring empresa config:', err);
  }
}
