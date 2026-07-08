/** Redondeo monetario a 2 decimales. */
function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * FUENTE ÚNICA del modelo de interés/cuota del préstamo.
 *
 * Modelo: interés fijo (flat) sobre el capital inicial por el periodo completo del
 * préstamo. `totalAPagar = monto * (1 + tasa)` y `cuota = totalAPagar / cuotas`.
 * (Puede migrarse a saldos insolutos si cambian las reglas de negocio — cambiar SOLO aquí.)
 *
 * Reutilizado por `generarCalendarioCuotas` (backend) y por las calculadoras del frontend,
 * para que el monto mostrado, el calculado y el persistido coincidan siempre.
 *
 * @param {number} montoAprobado - Monto del préstamo
 * @param {number} tasaInteres - Tasa como DECIMAL (ej. 0.05 = 5%)
 * @param {number} totalCuotas - Número de cuotas
 * @returns {{ interesTotal: number, totalAPagar: number, cuota: number, capitalPorCuota: number, interesPorCuota: number }}
 */
export function calcularResumenPrestamo(montoAprobado, tasaInteres, totalCuotas) {
  const monto = Number(montoAprobado) || 0;
  const tasa = Number(tasaInteres) || 0;
  const cuotas = Number(totalCuotas) || 0;

  if (monto <= 0 || cuotas <= 0) {
    return { interesTotal: 0, totalAPagar: 0, cuota: 0, capitalPorCuota: 0, interesPorCuota: 0 };
  }

  const capitalPorCuota = round2(monto / cuotas);
  const interesPorCuota = round2((monto * tasa) / cuotas);
  return {
    interesTotal: round2(monto * tasa),
    totalAPagar: round2(monto + monto * tasa),
    cuota: round2(monto / cuotas + (monto * tasa) / cuotas),
    capitalPorCuota,
    interesPorCuota,
  };
}

/**
 * Genera el calendario de pagos basado en la frecuencia y monto.
 *
 * @param {number} montoAprobado - Monto total del préstamo
 * @param {number} tasaInteres - Tasa de interés (ej. 0.05 para 5%)
 * @param {number} totalCuotas - Número de cuotas
 * @param {string} frecuencia - 'diario'|'semanal'|'quincenal'|'mensual'
 * @param {Date|string} fechaInicio - Fecha de inicio del préstamo
 * @returns {Array} - Array de objetos representando las cuotas
 */
export function generarCalendarioCuotas(montoAprobado, tasaInteres, totalCuotas, frecuencia, fechaInicio) {
  const cuotas = [];
  // Fuente única del modelo de interés/cuota (ya redondeado a 2 decimales).
  const { cuota: montoCuotaTotal, capitalPorCuota: montoCapital, interesPorCuota: montoInteres } =
    calcularResumenPrestamo(montoAprobado, tasaInteres, totalCuotas);

  let fechaVencimiento = new Date(fechaInicio);

  for (let i = 1; i <= totalCuotas; i++) {
    // Avanzar la fecha según frecuencia (desde la primera cuota)
    if (frecuencia === 'diario') {
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 1);
    } else if (frecuencia === 'semanal') {
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 7);
    } else if (frecuencia === 'quincenal') {
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);
    } else if (frecuencia === 'mensual') {
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);
    }

    cuotas.push({
      numero_cuota: i,
      monto_cuota: montoCuotaTotal,
      monto_capital: montoCapital,
      monto_interes: montoInteres,
      fecha_vencimiento: new Date(fechaVencimiento),
      estado: 'pendiente'
    });
  }

  return cuotas;
}
