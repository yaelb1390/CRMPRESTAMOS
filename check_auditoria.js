import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query(`
      SELECT 
        tabla, 
        accion, 
        datos_nuevos,
        created_at
      FROM auditoria 
      WHERE tabla IN ('prestamos', 'pagos') 
        AND accion = 'INSERT'
        AND DATE(created_at) = CURRENT_DATE
    `);
  console.log("Results for CURRENT_DATE:");
  console.log(JSON.stringify(res.rows, null, 2));
  
  // also get total count for today regardless of action
  const res2 = await pool.query(`SELECT COUNT(*) FROM auditoria WHERE DATE(created_at) = CURRENT_DATE`);
  console.log("Total auditoria for CURRENT_DATE:", res2.rows[0]);
  process.exit(0);
}

run();
