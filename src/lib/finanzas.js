/**
 * Constantes financieras por defecto (fuente única).
 *
 * Se usan como fallback cuando la tabla `configuracion_financiera` no tiene el valor
 * (ver `getConfig` en `@/lib/config`). Antes estaban duplicadas como números mágicos en
 * varias rutas de préstamos; cambiar aquí en un solo lugar.
 */
export const DEFAULTS_FINANCIEROS = {
  /** Tasa de interés por defecto, en DECIMAL (0.05 = 5%). */
  tasaInteres: 0.05,
  /** Monto mínimo prestable (RD$). */
  montoMinimo: 1000,
  /** Monto máximo prestable (RD$). */
  montoMaximo: 5000000,
};
