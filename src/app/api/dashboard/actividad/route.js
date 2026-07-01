import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        a.id, 
        a.tabla, 
        a.accion, 
        a.registro_id, 
        a.usuario_nombre, 
        a.created_at,
        a.datos_nuevos,
        c.nombre as cliente_nombre
      FROM auditoria a
      LEFT JOIN clientes c ON c.cedula = (a.datos_nuevos->>'cedula')
      WHERE a.tabla IN ('prestamos', 'pagos', 'clientes')
      ORDER BY a.id DESC 
      LIMIT 15
    `);

    // Formatear los datos para el frontend
    const actividad = res.rows.map(row => {
      let descripcion = '';
      let icono = '📋';
      let color = 'var(--text-muted)';
      
      let datos = {};
      try {
        if (typeof row.datos_nuevos === 'string') {
          datos = JSON.parse(row.datos_nuevos);
        } else if (row.datos_nuevos && typeof row.datos_nuevos === 'object') {
          datos = row.datos_nuevos;
        }
      } catch(e) {
        console.error('Error parsing datos_nuevos', e);
      }
      const esNuevo = row.accion === 'INSERT';
      const nombreCliente = row.cliente_nombre ? ` de ${row.cliente_nombre}` : '';

      switch(row.tabla) {
        case 'prestamos':
          icono = '💰';
          color = 'var(--success)';
          descripcion = esNuevo 
            ? `Registró un nuevo préstamo por RD$${datos.monto_aprobado || 0} a favor del cliente ${row.cliente_nombre || datos.cedula || 'N/A'}`
            : `Actualizó el préstamo ${row.registro_id}${nombreCliente}`;
          break;
        case 'pagos':
          icono = '💵';
          color = 'var(--primary)';
          descripcion = esNuevo
            ? `Registró un pago de RD$${datos.monto_pagado || 0} al préstamo ${datos.numero_prestamo || row.registro_id}${nombreCliente}`
            : `Modificó un pago del préstamo ${row.registro_id}`;
          break;
        case 'clientes':
          icono = '👥';
          color = 'var(--info)';
          descripcion = esNuevo
            ? `Registró al nuevo cliente ${datos.nombre || row.registro_id} en la plataforma`
            : `Actualizó los datos del cliente ${row.cliente_nombre || row.registro_id}`;
          break;
        default:
          descripcion = `${esNuevo ? 'Registró' : 'Actualizó'} datos en ${row.tabla} (${row.registro_id})`;
      }

      return {
        id: row.id,
        usuario: row.usuario_nombre || 'Sistema',
        tabla: row.tabla,
        accion: row.accion,
        descripcion,
        icono,
        color,
        fecha: row.created_at
      };
    });

    return NextResponse.json({ success: true, data: actividad });
  } catch (err) {
    console.error("Actividad API error:", err);
    return NextResponse.json({ error: "Error al obtener actividad reciente." }, { status: 500 });
  }
}
