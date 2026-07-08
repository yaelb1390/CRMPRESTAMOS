/**
 * Utilidades de formato (fuente única).
 *
 * Antes estaban duplicadas (formatCurrency en 7 archivos, formatDate en 6) con
 * comportamientos ligeramente divergentes. Centralizadas aquí para consistencia.
 */

/**
 * Formatea un valor como moneda dominicana: "RD$ 1,234.56".
 * Valores nulos/indefinidos/NaN se tratan como 0.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const num = Number(value);
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  })
    .format(safe)
    .replace('DOP', 'RD$');
}

/**
 * Formatea una fecha como "dd/mm/aaaa", corrigiendo el desfase de zona horaria
 * que ocurre al parsear fechas "solo-fecha" (YYYY-MM-DD) como UTC.
 * @param {string|Date|null|undefined} dateStr
 * @param {string} [fallback=''] - Valor a devolver si la fecha es vacía/ inválida.
 * @returns {string}
 */
export function formatDate(dateStr, fallback = '') {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return fallback;
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() + userTimezoneOffset);
  const day = String(localDate.getDate()).padStart(2, '0');
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const year = localDate.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Formatea fecha + hora en locale es-DO (para bitácoras/auditoría).
 * @param {string|Date|null|undefined} dateStr
 * @param {string} [fallback='']
 * @returns {string}
 */
export function formatDateTime(dateStr, fallback = '') {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('es-DO');
}
