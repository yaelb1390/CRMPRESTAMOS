import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    
    // Solo admins pueden ver auditorÃ­a
    if (!user || user.rol !== 'admin') {
      return NextResponse.json({ error: "Acceso denegado. Solo administradores pueden ver los registros de auditorÃ­a." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const countRes = await query("SELECT COUNT(*) FROM auditoria WHERE tabla = 'prestamos' AND usuario_nombre != 'Sistema'");
    const totalRecords = parseInt(countRes.rows[0].count);

    const res = await query(`
      SELECT * FROM auditoria
      WHERE tabla = 'prestamos' AND usuario_nombre != 'Sistema'
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    return NextResponse.json({
      data: res.rows,
      pagination: {
        totalRecords,
        limit,
        offset
      }
    });
  } catch (err) {
    console.error("GET auditoria API error:", err);
    return NextResponse.json({ error: "Error al obtener los registros de auditorÃ­a." }, { status: 500 });
  }
}
