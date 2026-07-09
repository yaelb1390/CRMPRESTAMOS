'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Contador animado estilo "millero": el valor sube desde 0 hasta `value`
 * con easing suave al montar. Respeta prefers-reduced-motion.
 *
 * @param {number} value    Valor final.
 * @param {function} format Formatea el número mostrado (ej. formatCurrency).
 * @param {number} duration Duración en ms (por defecto 1100).
 */
export default function CountUp({ value = 0, format = (v) => Math.round(v), duration = 1100 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;

    // Accesibilidad: sin animación si el usuario la reduce.
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || target === 0) {
      setDisplay(target);
      return;
    }

    let start = null;
    const tick = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(target);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <>{format(display)}</>;
}
