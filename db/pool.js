const { Pool } = require('pg');
const config = require('../config');
const logger = require('../config/logger');

const pool = new Pool({
  connectionString: config.db.url,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  // Idle client errors should never crash the process silently.
  logger.error({ err }, 'Unexpected error on idle Postgres client');
});

/**
 * Always call query() with a parameterized statement ($1, $2, ...).
 * Never build SQL by string concatenation — this is the project's single
 * chokepoint against SQL injection, so every route must go through it.
 */
async function query(text, params = []) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - start;
  if (ms > 200) logger.warn({ text, ms }, 'Slow query');
  return res;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
