import { query } from './src/lib/db.js';

async function test() {
  try {
    const res = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'prestamos';
    `);
    console.log("Columnas prestamos:", res.rows.map(r => r.column_name).join(", "));
  } catch(e) {
    console.error(e);
  }
}
test();
