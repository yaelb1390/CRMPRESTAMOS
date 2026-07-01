import { query } from '../src/lib/db.js';

async function patchCuotas() {
  console.log("Iniciando actualización de la base de datos...");
  try {
    // 1. Añadir la columna monto_pagado a la tabla cuotas si no existe
    await query(`
      ALTER TABLE cuotas 
      ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(12,2) DEFAULT 0
    `);
    
    // 2. Para las cuotas que ya estaban 'pagadas', igualar monto_pagado a monto_cuota
    await query(`
      UPDATE cuotas 
      SET monto_pagado = monto_cuota 
      WHERE estado = 'pagado' AND monto_pagado = 0
    `);
    
    console.log("✅ Actualización completada: Columna 'monto_pagado' añadida a 'cuotas'.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error actualizando la base de datos:", error);
    process.exit(1);
  }
}

patchCuotas();
