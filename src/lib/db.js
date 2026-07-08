import pg from 'pg';

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000, // 10 seconds connection timeout
  max: 10, // Recommended pool size for transaction pooler
  idleTimeoutMillis: 30000,
  ssl: {
    rejectUnauthorized: false
  }
};

let pool;

if (process.env.NODE_ENV === 'production') {
  pool = new pg.Pool(poolConfig);
} else {
  if (!global.dbPool) {
    global.dbPool = new pg.Pool(poolConfig);
  }
  pool = global.dbPool;
}

/**
 * Execute a query with connection pooling and a 1-retry mechanism.
 * @param {string} text - SQL query string
 * @param {any[]} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  let retries = 1;
  while (true) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      if (retries > 0) {
        console.warn(`Database query failed, retrying once. Error: ${err.message}`);
        retries--;
        await new Promise(resolve => setTimeout(resolve, 200)); // small delay before retry
        continue;
      }
      console.error(`Database query failed after retry: ${err.message}`);
      throw err;
    }
  }
}

/**
 * Run a set of statements inside a single atomic transaction.
 *
 * The callback receives a query function `q(text, params)` that is bound to ONE
 * dedicated client checked out from the pool, so BEGIN/COMMIT/ROLLBACK and every
 * statement in between share the same connection. This is required for correctness
 * in money-handling paths — do NOT use the pooled `query()` (which may run each
 * statement on a different connection, and retries) inside a transaction.
 *
 * COMMIT on success, ROLLBACK if the callback throws; the client is always released.
 *
 * @template T
 * @param {(q: (text: string, params?: any[]) => Promise<import('pg').QueryResult>, client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  const q = (text, params) => client.query(text, params);
  try {
    await client.query('BEGIN');
    const result = await fn(q, client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error(`Transaction rollback failed: ${rollbackErr.message}`);
    }
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
