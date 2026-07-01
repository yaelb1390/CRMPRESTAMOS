import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get('periodo') || 'quincena'; // dia, quincena, mes
    
    let daysToFetch = 15;
    if (periodo === 'dia') daysToFetch = 7;
    if (periodo === 'mes') daysToFetch = 30;

    const res = await query(`
      SELECT 
        DATE(created_at AT TIME ZONE 'America/Santo_Domingo') as fecha,
        tabla, 
        accion, 
        datos_nuevos
      FROM auditoria 
      WHERE tabla IN ('prestamos', 'pagos') 
        AND accion = 'INSERT'
        AND created_at >= NOW() - INTERVAL '${daysToFetch + 1} days'
      ORDER BY created_at ASC
    `);

    // Agrupar por fecha
    const grouped = {};
    
    // Inicializar los últimos 'daysToFetch' días con 0
    for(let i = daysToFetch - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      grouped[dateStr] = { 
        name: dateStr.split('-').slice(1).join('/'), // MM/DD 
        prestamos: 0, 
        cobros: 0 
      };
    }

    res.rows.forEach(row => {
      // Row date formatting based on postgres return type
      let dateStr = '';
      if (row.fecha instanceof Date) {
        dateStr = row.fecha.toISOString().split('T')[0];
      } else {
        // En caso de que se devuelva como string "YYYY-MM-DD" o similar
        dateStr = String(row.fecha).split('T')[0];
      }

      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          name: dateStr.split('-').slice(1).join('/'),
          prestamos: 0,
          cobros: 0
        };
      }

      let datos = {};
      try {
        if (typeof row.datos_nuevos === 'string') {
          datos = JSON.parse(row.datos_nuevos);
        } else if (row.datos_nuevos && typeof row.datos_nuevos === 'object') {
          datos = row.datos_nuevos;
        }
      } catch (e) {}

      if (row.tabla === 'prestamos') {
        grouped[dateStr].prestamos += parseFloat(datos.monto_aprobado || 0);
      } else if (row.tabla === 'pagos') {
        grouped[dateStr].cobros += parseFloat(datos.monto_pagado || 0);
      }
    });

    // Convert object back to sorted array
    const chartData = Object.keys(grouped).sort().map(key => grouped[key]);

    return NextResponse.json({ success: true, data: chartData });
  } catch (err) {
    console.error("Graficas API error:", err);
    return NextResponse.json({ error: "Error al obtener datos para gráficas." }, { status: 500 });
  }
}
