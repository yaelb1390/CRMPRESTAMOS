import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { generarCalendarioCuotas, calcularResumenPrestamo } from '@/lib/cuotas';
import { getConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/auth';
import { DEFAULTS_FINANCIEROS } from '@/lib/finanzas';

export async function GET(request) {
  try {
    // Asegurar que las columnas de desembolso existan (self-healing)
    await query(`
      ALTER TABLE prestamos 
      ADD COLUMN IF NOT EXISTS metodo_desembolso VARCHAR(30) DEFAULT 'efectivo',
      ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(100),
      ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(50)
    `);

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') || '';
    const dias_min_str = searchParams.get('dias_min') || '';
    const fecha_desde = searchParams.get('fecha_desde') || '';
    const fecha_hasta = searchParams.get('fecha_hasta') || '';

    let whereClause = [];
    let params = [];
    let paramIndex = 1;

    if (estado) {
      whereClause.push(`p.estado = $${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    if (dias_min_str) {
      const dias_min = parseInt(dias_min_str);
      if (!isNaN(dias_min)) {
        whereClause.push(`GREATEST(0, (CURRENT_DATE - p.fecha_proximo_pago::date)) >= $${paramIndex}`);
        params.push(dias_min);
        paramIndex++;
      }
    }

    if (fecha_desde) {
      whereClause.push(`p.fecha_proximo_pago >= $${paramIndex}`);
      params.push(fecha_desde);
      paramIndex++;
    }

    if (fecha_hasta) {
      whereClause.push(`p.fecha_proximo_pago <= $${paramIndex}`);
      params.push(fecha_hasta);
      paramIndex++;
    }

    const user = await getCurrentUser(request);
    if (user && user.rol !== 'admin') {
      // Colaboradores ven todos los préstamos activos y atrasados (no los ya pagados)
      whereClause.push(`p.estado != 'pagado'`);
    }

    const whereSql = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p.id, p.cedula, c.nombre as nombre_cliente, p.numero_prestamo, 
        p.monto_aprobado, p.balance_pendiente, p.cuota_mensual, 
        p.fecha_proximo_pago, p.estado, p.tipo_frecuencia, p.tasa_interes,
        p.total_cuotas, p.cuotas_pagadas, p.created_at, 
        p.metodo_desembolso, p.banco_nombre, p.numero_cuenta,
        GREATEST(0, (CURRENT_DATE - p.fecha_proximo_pago::date)) AS dias_atraso_calc
      FROM prestamos p
      LEFT JOIN clientes c ON p.cedula = c.cedula
      ${whereSql}
      ORDER BY dias_atraso_calc DESC NULLS LAST, p.fecha_proximo_pago ASC NULLS LAST
    `;

    const res = await query(sql, params);

    return NextResponse.json({
      data: res.rows.map(row => {
        const montoAprobado = parseFloat(row.monto_aprobado);
        const tasaInteres = parseFloat(row.tasa_interes) || 0;
        const totalCuotas = parseInt(row.total_cuotas) || 1;
        // Monto total original vía la fórmula única (evita duplicar el cálculo en SQL).
        const { totalAPagar } = calcularResumenPrestamo(montoAprobado, tasaInteres, totalCuotas);
        return {
          ...row,
          monto_aprobado: montoAprobado,
          balance_pendiente: parseFloat(row.balance_pendiente),
          cuota_mensual: parseFloat(row.cuota_mensual),
          tasa_interes: tasaInteres,
          monto_total_original: totalAPagar || parseFloat(row.balance_pendiente),
          cuotas_pagadas: parseInt(row.cuotas_pagadas) || 0,
          dias_atraso: parseInt(row.dias_atraso_calc) || 0
        };
      })
    });
  } catch (err) {
    console.error("Loans GET API error:", err);
    return NextResponse.json({ error: "Error de base de datos al buscar préstamos." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    const registradoPor = user ? user.nombre : 'Sistema';

    const body = await request.json();
    const { 
      cedula, 
      monto_aprobado, 
      frecuencia, 
      total_cuotas, 
      fecha_inicio, 
      tasa_interes,
      metodo_desembolso,
      banco_nombre,
      numero_cuenta
    } = body;

    if (!cedula) return NextResponse.json({ error: "Cédula es requerida." }, { status: 400 });
    
    // Check client exists
    const checkClient = await query("SELECT nombre FROM clientes WHERE cedula = $1", [cedula]);
    if (checkClient.rows.length === 0) {
       return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const monto = parseFloat(monto_aprobado);
    if (isNaN(monto) || monto <= 0) {
      return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
    }

    const min = parseFloat(await getConfig('monto_minimo', DEFAULTS_FINANCIEROS.montoMinimo));
    const max = parseFloat(await getConfig('monto_maximo', DEFAULTS_FINANCIEROS.montoMaximo));

    if (monto < min) {
      return NextResponse.json({ error: `El monto no puede ser menor a RD$ ${min.toLocaleString()}` }, { status: 400 });
    }
    if (monto > max) {
      return NextResponse.json({ error: `El monto no puede ser mayor a RD$ ${max.toLocaleString()}` }, { status: 400 });
    }

    const cuotasNum = parseInt(total_cuotas);
    if (isNaN(cuotasNum) || cuotasNum <= 0) {
      return NextResponse.json({ error: "Cantidad de cuotas inválida." }, { status: 400 });
    }

    const interes = parseFloat(tasa_interes) || DEFAULTS_FINANCIEROS.tasaInteres;

    // Generate Cuotas Calendar (cálculo puro; fuera de la transacción)
    const fInicio = fecha_inicio ? new Date(fecha_inicio) : new Date();
    const calendario = generarCalendarioCuotas(monto, interes, cuotasNum, frecuencia || 'mensual', fInicio);

    const cuotaMensualEstimada = calendario[0].monto_cuota;
    const fechaProximoPago = calendario[0].fecha_vencimiento.toISOString().split('T')[0];
    const balanceTotal = calendario.reduce((sum, c) => sum + c.monto_cuota, 0);

    // Asegurar que las columnas de desembolso existan (self-healing)
    await query(`
      ALTER TABLE prestamos
      ADD COLUMN IF NOT EXISTS metodo_desembolso VARCHAR(30) DEFAULT 'efectivo',
      ADD COLUMN IF NOT EXISTS banco_nombre VARCHAR(100),
      ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(50)
    `);

    const currentYear = new Date().getFullYear();
    const yearPrefix = `PBM-${currentYear}-`;

    // Número de préstamo + todas las escrituras en una sola transacción atómica.
    const generatedLoanNumber = await withTransaction(async (q) => {
      // Generar el número dentro de la transacción para reducir la ventana de colisión.
      const lastLoanRes = await q(
        "SELECT numero_prestamo FROM prestamos WHERE numero_prestamo LIKE $1 ORDER BY numero_prestamo DESC LIMIT 1",
        [`${yearPrefix}%`]
      );

      let nextNumber = 1;
      if (lastLoanRes.rows.length > 0) {
        const parts = lastLoanRes.rows[0].numero_prestamo.split('-');
        if (parts.length === 3) nextNumber = parseInt(parts[2]) + 1 || 1;
      }
      const loanNumber = `${yearPrefix}${String(nextNumber).padStart(4, '0')}`;

      await q(`
        INSERT INTO prestamos (
          cedula, numero_prestamo, monto_aprobado, balance_pendiente, cuota_mensual,
          fecha_proximo_pago, estado, tipo_frecuencia, total_cuotas, tasa_interes, registrado_por,
          metodo_desembolso, banco_nombre, numero_cuenta
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        cedula, loanNumber, monto, balanceTotal, cuotaMensualEstimada,
        fechaProximoPago, 'activo', frecuencia || 'mensual', cuotasNum, interes, registradoPor,
        metodo_desembolso || 'efectivo', banco_nombre || null, numero_cuenta || null
      ]);

      // Update total loans on client
      await q(
        "UPDATE clientes SET total_prestamos = total_prestamos + 1, capital_prestado = capital_prestado + $1 WHERE cedula = $2",
        [monto, cedula]
      );

      // Insert Cuotas
      for (const c of calendario) {
        await q(`
          INSERT INTO cuotas (
            numero_prestamo, cedula, numero_cuota, monto_cuota, monto_capital, monto_interes, fecha_vencimiento, estado
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          loanNumber, cedula, c.numero_cuota, c.monto_cuota, c.monto_capital, c.monto_interes,
          c.fecha_vencimiento.toISOString().split('T')[0], 'pendiente'
        ]);
      }

      return loanNumber;
    });

    // Auditoria
    try {
      const { registrarAuditoria } = await import('@/lib/audit');
      await registrarAuditoria({
        tabla: 'prestamos',
        accion: 'INSERT',
        registro_id: generatedLoanNumber,
        datos_nuevos: { 
          cedula, 
          monto_aprobado, 
          frecuencia, 
          total_cuotas, 
          metodo_desembolso: metodo_desembolso || 'efectivo', 
          banco_nombre: banco_nombre || null, 
          numero_cuenta: numero_cuenta || null 
        },
        usuario: user
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      message: "Préstamo creado correctamente.",
      data: { numero_prestamo: generatedLoanNumber }
    });
  } catch (err) {
    console.error("Loans POST API error:", err);
    return NextResponse.json({ error: "Error al crear el préstamo." }, { status: 500 });
  }
}
