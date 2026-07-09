import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Configuración por granularidad: unidad de date_trunc y nº de cubos a mostrar.
const PERIODOS = {
  dia: { unit: 'day', count: 30 },
  mes: { unit: 'month', count: 12 },
  trimestre: { unit: 'quarter', count: 8 },
  anual: { unit: 'year', count: 5 },
};

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Genera los cubos (buckets) continuos con su clave (fecha de inicio del cubo) y etiqueta.
function construirCubos(periodo) {
  const { count } = PERIODOS[periodo];
  const now = new Date();
  const cubos = [];
  for (let i = count - 1; i >= 0; i--) {
    let d;
    let label;
    if (periodo === 'dia') {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    } else if (periodo === 'mes') {
      d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      label = `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    } else if (periodo === 'trimestre') {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      d = new Date(now.getFullYear(), qStartMonth - i * 3, 1);
      label = `T${Math.floor(d.getMonth() / 3) + 1} ${String(d.getFullYear()).slice(2)}`;
    } else {
      d = new Date(now.getFullYear() - i, 0, 1);
      label = String(d.getFullYear());
    }
    cubos.push({ key: isoDate(d), label });
  }
  return cubos;
}

export async function GET(request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodo = PERIODOS[searchParams.get('periodo')] ? searchParams.get('periodo') : 'mes';
  const { unit } = PERIODOS[periodo];

  try {
    const cubos = construirCubos(periodo);
    const since = cubos[0].key; // fecha de inicio del cubo más antiguo

    const [cobrosRes, prestamosRes] = await Promise.all([
      query(
        `SELECT to_char(date_trunc($2, fecha_pago)::date, 'YYYY-MM-DD') as bucket,
                SUM(monto_pagado) as total
         FROM pagos
         WHERE fecha_pago >= $1::date
         GROUP BY 1`,
        [since, unit]
      ),
      query(
        `SELECT to_char(date_trunc($2, COALESCE(fecha_inicio, created_at))::date, 'YYYY-MM-DD') as bucket,
                SUM(monto_aprobado) as total
         FROM prestamos
         WHERE COALESCE(fecha_inicio, created_at) >= $1::date
         GROUP BY 1`,
        [since, unit]
      ),
    ]);

    const cobrosMap = new Map(cobrosRes.rows.map((r) => [r.bucket, parseFloat(r.total) || 0]));
    const prestamosMap = new Map(prestamosRes.rows.map((r) => [r.bucket, parseFloat(r.total) || 0]));

    const data = cubos.map((c) => ({
      label: c.label,
      cobros: cobrosMap.get(c.key) || 0,
      prestamos: prestamosMap.get(c.key) || 0,
    }));

    return NextResponse.json({ periodo, data });
  } catch (err) {
    console.error('Series API error:', err);
    return NextResponse.json({ error: 'Error al obtener las series de tiempo.' }, { status: 500 });
  }
}
