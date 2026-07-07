import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { query } from '@/lib/db';
import { getSecretKey } from '@/lib/auth';

export async function GET(request) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    // Asegurar que la columna permisos exista en usuarios (self-healing)
    await query(`
      ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT '[]'
    `);

    // Consultar dinÃ¡micamente el usuario para obtener permisos y rol actualizados en tiempo real
    const dbUserRes = await query("SELECT id, username, nombre, rol, permisos FROM usuarios WHERE id = $1", [payload.id]);
    
    if (dbUserRes.rows.length === 0) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const dbUser = dbUserRes.rows[0];

    return NextResponse.json({ 
      user: {
        id: dbUser.id,
        username: dbUser.username,
        nombre: dbUser.nombre,
        rol: dbUser.rol,
        permisos: Array.isArray(dbUser.permisos) ? dbUser.permisos : []
      } 
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
