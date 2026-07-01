import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { jwtVerify } from 'jose';
import { calcularScore } from '@/lib/score';

async function getCurrentUser(request) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;
    const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (err) {
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cedula = searchParams.get('cedula');
    const numeroPrestamo = searchParams.get('numero_prestamo');

    let res;
    if (numeroPrestamo) {
      res = await query("SELECT * FROM pagos WHERE numero_prestamo = $1 ORDER BY fecha_pago DESC", [numeroPrestamo]);
    } else if (cedula) {
      res = await query("SELECT * FROM pagos WHERE cedula = $1 ORDER BY fecha_pago DESC", [cedula]);
    } else {
      res = await query(`
        SELECT p.*, c.nombre as nombre_cliente 
        FROM pagos p 
        LEFT JOIN clientes c ON p.cedula = c.cedula 
        ORDER BY p.fecha_pago DESC LIMIT 50
      `);
    }

    return NextResponse.json({
      data: res.rows.map(row => ({
        ...row,
        monto_pagado: parseFloat(row.monto_pagado)
      }))
    });
  } catch (err) {
    console.error("GET payments API error:", err);
    return NextResponse.json({ error: "Error de base de datos al obtener pagos." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    const registradoPor = user ? user.nombre : 'Sistema';

    const body = await request.json();
    const { numero_prestamo, cedula, monto_pagado, metodo_pago, comentario } = body;

    if (!numero_prestamo || !cedula) {
      return NextResponse.json({ error: "Número de préstamo y cédula son requeridos." }, { status: 400 });
    }

    const payAmount = parseFloat(monto_pagado);
    if (isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: "El monto pagado debe ser un número positivo." }, { status: 400 });
    }

    // Comprobar préstamo
    const loanRes = await query(
      "SELECT balance_pendiente, estado, dias_atraso, fecha_proximo_pago, tipo_frecuencia FROM prestamos WHERE numero_prestamo = $1 AND cedula = $2",
      [numero_prestamo, cedula]
    );

    if (loanRes.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró ningún préstamo activo coincidente." }, { status: 404 });
    }

    const loan = loanRes.rows[0];
    let currentBalance = parseFloat(loan.balance_pendiente);

    if (payAmount > currentBalance) {
      return NextResponse.json({
        error: `El monto pagado (RD$ ${payAmount.toFixed(2)}) no puede ser mayor que el balance pendiente (RD$ ${currentBalance.toFixed(2)}).`
      }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Auto-migraciones para asegurar que las columnas existan (por si acaso la BD no las tiene)
      try {
        await client.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS monto_pagado DECIMAL(12,2) DEFAULT 0`);
        await client.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50)`);
        await client.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS registrado_por VARCHAR(100)`);
        await client.query(`ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comentario TEXT`);
        
        await client.query(`ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS monto_pagado DECIMAL(12,2) DEFAULT 0`);
        await client.query(`ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP`);
        await client.query(`ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS pago_id INTEGER`);
        
        await client.query(`ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS cuotas_pagadas INTEGER DEFAULT 0`);
        await client.query(`ALTER TABLE prestamos ADD COLUMN IF NOT EXISTS dias_atraso INTEGER DEFAULT 0`);
        
        await client.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS capital_pagado DECIMAL(12,2) DEFAULT 0`);
        await client.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS prestamos_liquidados INTEGER DEFAULT 0`);
      } catch (migErr) {
        console.log("Error en auto-migracion:", migErr.message);
      }

      // Insertar pago
      const insertRes = await client.query(`
        INSERT INTO pagos (numero_prestamo, cedula, monto_pagado, metodo_pago, registrado_por, comentario)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, fecha_pago
      `, [numero_prestamo, cedula, payAmount, metodo_pago || 'efectivo', registradoPor, comentario || '']);
      
      const newPayment = insertRes.rows[0];

      // Aplicar pago a las cuotas pendientes (de más antigua a más nueva)
      const cuotasRes = await client.query(`
        SELECT id, monto_cuota, fecha_vencimiento, COALESCE(monto_pagado, 0) as monto_pagado
        FROM cuotas 
        WHERE numero_prestamo = $1 AND estado != 'pagado'
        ORDER BY numero_cuota ASC
      `, [numero_prestamo]);

      let montoRestante = payAmount;
      let cuotasPagadas = 0;

      for (const cuota of cuotasRes.rows) {
        if (montoRestante <= 0) break;
        const montoCuota = parseFloat(cuota.monto_cuota);
        const montoYaPagado = parseFloat(cuota.monto_pagado) || 0;
        const saldoPendienteCuota = montoCuota - montoYaPagado;
        
        if (saldoPendienteCuota <= 0) continue;
        
        if (montoRestante >= saldoPendienteCuota) {
          // Paga la cuota completa
          await client.query(
            "UPDATE cuotas SET estado = 'pagado', monto_pagado = $1, fecha_pago = CURRENT_TIMESTAMP, pago_id = $2 WHERE id = $3",
            [montoCuota, newPayment.id, cuota.id]
          );
          montoRestante -= saldoPendienteCuota;
          cuotasPagadas++;
        } else {
          // Pago parcial de la cuota
          const nuevoMontoPagado = montoYaPagado + montoRestante;
          await client.query(
            "UPDATE cuotas SET monto_pagado = $1, pago_id = $2 WHERE id = $3",
            [nuevoMontoPagado, newPayment.id, cuota.id]
          );
          montoRestante = 0;
          break;
        }
      }

      // Actualizar balance del préstamo
      const newBalance = Math.max(0, currentBalance - payAmount);
      let nextEstado = loan.estado;

      if (newBalance <= 0) {
        nextEstado = 'pagado';
      }

      // --- Calcular nueva fecha_proximo_pago y dias_atraso reales ---
      // Buscar la próxima cuota pendiente después de los pagos aplicados
      const proximaCuotaRes = await client.query(`
        SELECT fecha_vencimiento
        FROM cuotas
        WHERE numero_prestamo = $1 AND estado != 'pagado'
        ORDER BY numero_cuota ASC
        LIMIT 1
      `, [numero_prestamo]);

      let nuevaFechaProximoPago = loan.fecha_proximo_pago; // conservar si no hay siguiente
      let newDiasAtraso = 0;

      if (nextEstado !== 'pagado' && proximaCuotaRes.rows.length > 0) {
        // Obtener la fecha de la próxima cuota pendiente
        const rawFecha = proximaCuotaRes.rows[0].fecha_vencimiento;
        const fechaObj = rawFecha instanceof Date ? rawFecha : new Date(rawFecha);
        
        // Garantizar formato ISO local (YYYY-MM-DD) para evitar saltos UTC
        const yyyy = fechaObj.getFullYear();
        const mm = String(fechaObj.getMonth() + 1).padStart(2, '0');
        const dd = String(fechaObj.getDate()).padStart(2, '0');
        nuevaFechaProximoPago = `${yyyy}-${mm}-${dd}`;

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaObj.setHours(0, 0, 0, 0);
        const diffMs = hoy - fechaObj;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        newDiasAtraso = Math.max(0, diffDias);
        nextEstado = newDiasAtraso > 0 ? 'atrasado' : 'activo';
      }

      await client.query(`
        UPDATE prestamos 
        SET balance_pendiente = $1, estado = $2, cuotas_pagadas = cuotas_pagadas + $3,
            dias_atraso = $4, fecha_proximo_pago = $5
        WHERE numero_prestamo = $6
      `, [newBalance, nextEstado, cuotasPagadas, newDiasAtraso, nextEstado !== 'pagado' ? nuevaFechaProximoPago : loan.fecha_proximo_pago, numero_prestamo]);

      // Actualizar capital pagado en la tabla clientes
      await client.query(
        "UPDATE clientes SET capital_pagado = capital_pagado + $1 WHERE cedula = $2",
        [payAmount, cedula]
      );

      // Si el préstamo se liquidó completamente, actualizar métricas del cliente y score
      if (newBalance <= 0) {
        await client.query(`
          UPDATE clientes 
          SET prestamos_liquidados = prestamos_liquidados + 1
          WHERE cedula = $1
        `, [cedula]);

        // Recalcular score crediticio
        const statsRes = await client.query(`
          SELECT 
            cuotas_puntuales, cuotas_tardias, prestamos_liquidados, total_prestamos, 
            max_dias_atraso, promedio_dias_atraso 
          FROM clientes WHERE cedula = $1
        `, [cedula]);
        
        if (statsRes.rows.length > 0) {
          const { score, clasificacion } = calcularScore(statsRes.rows[0]);
          await client.query(
            "UPDATE clientes SET score_crediticio = $1, clasificacion = $2 WHERE cedula = $3",
            [score, clasificacion, cedula]
          );
        }
      }

      await client.query('COMMIT');

      // Auditoría (no bloquea el flujo si falla)
      try {
        const { registrarAuditoria } = await import('@/lib/audit');
        await registrarAuditoria({
          tabla: 'pagos',
          accion: 'INSERT',
          registro_id: newPayment.id,
          datos_nuevos: { numero_prestamo, monto_pagado: payAmount, metodo_pago, cedula },
          usuario: user
        });
      } catch (e) {
        console.warn("Auditoría falló (no crítico):", e.message);
      }

      return NextResponse.json({
        success: true,
        message: "Pago registrado correctamente",
        data: {
          pagoId: newPayment.id,
          balanceRestante: newBalance,
          estadoPrestamo: nextEstado,
          cuotasPagadas
        }
      }, { status: 201 });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("POST payments API error:", err);
    return NextResponse.json({ error: "Error al registrar el pago: " + (err.message || err.toString()) }, { status: 500 });
  }
}
