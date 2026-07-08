/**
 * Días de atraso (siempre >= 0) entre una fecha de vencimiento y "hoy",
 * normalizando ambas a medianoche local para evitar desfases por hora/UTC.
 *
 * FUENTE ÚNICA — reemplaza los cálculos duplicados que existían en
 * `pagos/route.js` y `prestamos/actualizar-mora/route.js`.
 *
 * Nota: devuelve los días crudos de atraso. El período de gracia (`dias_gracia`)
 * es una regla de mora y se aplica en la capa de mora, no aquí.
 *
 * @param {Date|string|null|undefined} fechaVencimiento
 * @param {Date} [hoy=new Date()]
 * @returns {number}
 */
export function calcularDiasAtraso(fechaVencimiento, hoy = new Date()) {
  if (!fechaVencimiento) return 0;
  const venc = fechaVencimiento instanceof Date ? new Date(fechaVencimiento) : new Date(fechaVencimiento);
  if (Number.isNaN(venc.getTime())) return 0;
  venc.setHours(0, 0, 0, 0);

  const ref = new Date(hoy);
  ref.setHours(0, 0, 0, 0);

  const diffDias = Math.floor((ref - venc) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDias);
}
