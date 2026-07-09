import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ensureEmpresaConfig, EMPRESA_DEFAULTS } from '@/lib/schema';

/**
 * GET /api/configuracion/empresa
 *
 * Datos de la empresa para el encabezado de la factura/recibo (nombre, RNC,
 * dirección, teléfono). Accesible a cualquier usuario autenticado (admin o
 * colaborador) porque el recibo se imprime desde el módulo de Cobros.
 * La edición se hace desde el módulo de Configuración (admin).
 */
export async function GET(request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    await ensureEmpresaConfig();

    const claves = EMPRESA_DEFAULTS.map((d) => d.clave);
    const res = await query(
      `SELECT clave, valor FROM configuracion_financiera WHERE clave = ANY($1)`,
      [claves]
    );

    const map = new Map(res.rows.map((r) => [r.clave, r.valor]));
    const val = (clave) => map.get(clave) ?? EMPRESA_DEFAULTS.find((d) => d.clave === clave)?.valor ?? '';

    return NextResponse.json({
      empresa: {
        nombre: val('empresa_nombre'),
        rnc: val('empresa_rnc'),
        direccion: val('empresa_direccion'),
        telefono: val('empresa_telefono'),
      },
    });
  } catch (err) {
    console.error('Empresa config GET error:', err);
    // Fallback a defaults para no romper la impresión del recibo.
    return NextResponse.json({
      empresa: {
        nombre: EMPRESA_DEFAULTS.find((d) => d.clave === 'empresa_nombre').valor,
        rnc: '',
        direccion: EMPRESA_DEFAULTS.find((d) => d.clave === 'empresa_direccion').valor,
        telefono: '',
      },
    });
  }
}
