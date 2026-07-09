import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    // Select payment and join client info.
    // balance_pendiente se calcula AL MOMENTO de este pago (histórico), no el actual:
    //   balance_al_momento = balance_actual_del_prestamo + pagos POSTERIORES a este.
    // Así el recibo de un pago viejo muestra el saldo que quedaba entonces, no 0
    // si el préstamo ya se saldó después.
    const res = await query(`
      SELECT p.*, pr.nombre_cliente, pr.monto_aprobado, pr.cuota_mensual,
             pr.estado as estado_prestamo, pr.dias_atraso,
             COALESCE(pr.balance_pendiente, 0) AS balance_actual,
             COALESCE((
               SELECT SUM(pp.monto_pagado) FROM pagos pp
               WHERE pp.numero_prestamo = p.numero_prestamo AND pp.id > p.id
             ), 0) AS pagos_posteriores
      FROM pagos p
      LEFT JOIN prestamos pr ON p.numero_prestamo = pr.numero_prestamo
      WHERE p.id = $1
    `, [id]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró ningún registro de pago con este ID." }, { status: 404 });
    }

    const row = res.rows[0];
    // Saldo pendiente al momento de este pago (ver comentario del query).
    const balancePendiente = (parseFloat(row.balance_actual) || 0) + (parseFloat(row.pagos_posteriores) || 0);
    return NextResponse.json({
      data: {
        ...row,
        monto_pagado: parseFloat(row.monto_pagado),
        monto_aprobado: parseFloat(row.monto_aprobado),
        cuota_mensual: parseFloat(row.cuota_mensual),
        balance_pendiente: balancePendiente,
        dias_atraso: parseInt(row.dias_atraso)
      }
    });

  } catch (err) {
    console.error("GET payment detail API error:", err);
    return NextResponse.json({ error: "Error de base de datos al obtener el detalle del pago." }, { status: 500 });
  }
}
