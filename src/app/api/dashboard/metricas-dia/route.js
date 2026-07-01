import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // Para simplificar y evitar problemas de JSON en diferentes motores,
    // buscamos las acciones de hoy y sumamos en JS.
    const res = await query(`
      SELECT 
        tabla, 
        accion, 
        datos_nuevos,
        created_at
      FROM auditoria 
      WHERE tabla IN ('prestamos', 'pagos') 
        AND accion = 'INSERT'
        AND created_at >= NOW() - INTERVAL '48 hours'
    `);

    // Obtenemos la fecha de hoy en formato local (República Dominicana o timezone general)
    // Para evitar problemas con UTC (donde el día cambia a las 8:00 PM local)
    const today = new Date();
    // Ajustar a timezone local (-4 hours for DR approx, or just use locale date string)
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }); 

    let prestamosDia = 0;
    let montoPrestamosDia = 0;
    let cobrosDia = 0;
    let montoCobrosDia = 0;

    res.rows.forEach(row => {
      // Filtrar por fecha local
      const rowDate = new Date(row.created_at);
      const rowDateStr = rowDate.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
      
      if (rowDateStr !== todayStr) return; // Ignorar si no es de hoy localmente
      let datos = {};
      try {
        if (typeof row.datos_nuevos === 'string') {
          datos = JSON.parse(row.datos_nuevos);
        } else if (row.datos_nuevos && typeof row.datos_nuevos === 'object') {
          datos = row.datos_nuevos;
        }
      } catch (e) {
        console.error('Error parseando JSON de auditoria en metricas-dia', e);
      }

      if (row.tabla === 'prestamos') {
        prestamosDia++;
        montoPrestamosDia += parseFloat(datos.monto_aprobado || 0);
      } else if (row.tabla === 'pagos') {
        cobrosDia++;
        montoCobrosDia += parseFloat(datos.monto_pagado || 0);
      }
    });

    return NextResponse.json({ 
      success: true, 
      prestamosDia, 
      montoPrestamosDia, 
      cobrosDia, 
      montoCobrosDia 
    });
  } catch (err) {
    console.error("Metricas-dia API error:", err);
    return NextResponse.json({ error: "Error al obtener métricas del día." }, { status: 500 });
  }
}
