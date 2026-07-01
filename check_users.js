import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query('SELECT username, rol, permisos FROM usuarios');
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

run();
