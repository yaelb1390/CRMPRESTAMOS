'use client';

import { useEffect, useRef } from 'react';

// ECharts se carga bajo demanda (lazy) y se comparte entre todos los gráficos,
// para no inflar el bundle inicial del dashboard.
let echartsPromise = null;
function loadECharts() {
  if (!echartsPromise) echartsPromise = import('echarts');
  return echartsPromise;
}

/**
 * Envoltorio reutilizable de Apache ECharts.
 * - Carga diferida de la librería (mejor rendimiento inicial).
 * - La animación de "relleno" se dispara cuando el gráfico ENTRA en el viewport
 *   (IntersectionObserver), no al montarse. Así el efecto se ve aunque el gráfico
 *   esté debajo del fold: se llena a medida que el usuario hace scroll.
 * - Responsive vía ResizeObserver y limpieza (dispose) al desmontar.
 */
export default function EChart({ option, height = 300, className = '', ariaLabel }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const optionRef = useRef(option);
  const startedRef = useRef(false);
  optionRef.current = option;

  useEffect(() => {
    let disposed = false;
    let ro;
    let io;

    loadECharts().then((echarts) => {
      if (disposed || !elRef.current) return;
      const chart = echarts.init(elRef.current, null, { renderer: 'canvas' });
      chartRef.current = chart;

      ro = new ResizeObserver(() => chart.resize());
      ro.observe(elRef.current);

      // Primer render (con animación) al hacerse visible.
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting) && !startedRef.current) {
            startedRef.current = true;
            if (optionRef.current) chart.setOption(optionRef.current);
            io.disconnect();
          }
        },
        { threshold: 0.2 }
      );
      io.observe(elRef.current);
    });

    return () => {
      disposed = true;
      startedRef.current = false;
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambios de opción posteriores (ej. cambiar periodo/tipo) re-renderizan con animación.
  useEffect(() => {
    if (chartRef.current && startedRef.current && option) {
      chartRef.current.setOption(option, true);
    }
  }, [option]);

  return (
    <div
      ref={elRef}
      className={className}
      style={{ width: '100%', height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
