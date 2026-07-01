import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    
    // Check columns of auditoria table
    const colsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'auditoria'
    `);
    
    // Check if there's any data
    const dataRes = await client.query('SELECT * FROM auditoria ORDER BY 1 DESC LIMIT 3');
    
    client.release();
    return NextResponse.json({
      success: true,
      columns: colsRes.rows.map(r => r.column_name),
      data: dataRes.rows,
      message: "Consulta a auditoria exitosa"
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack
    }, { status: 500 });
  }
}
