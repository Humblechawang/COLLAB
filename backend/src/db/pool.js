const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../config/logger');

function sslOption(dbConfig = config.db) {
  if (!dbConfig.ssl) return false;
  const ssl = { rejectUnauthorized: dbConfig.sslRejectUnauthorized !== false };
  if (dbConfig.sslCaFile) {
    ssl.ca = fs.readFileSync(path.resolve(dbConfig.sslCaFile));
  }
  return ssl;
}

function makePool(connectionString) {
  return new Pool({
    connectionString,
    ssl: sslOption(),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

let pool = null;

function ensurePool() {
  if (!config.db.url) {
    const err = new Error('Database is not configured.');
    err.status = 503;
    throw err;
  }

  if (!pool) {
    pool = makePool(config.db.url);
    pool.on('error', (err) => {
      logger.error({ err: { message: err.message, name: err.name } }, 'Unexpected error on idle Postgres client');
    });
  }

  return pool;
}

function rlsClaimsFor(req) {
  if (req && req.user && req.user.id) {
    return { sub: String(req.user.id), role: 'authenticated' };
  }
  return { role: 'anon' };
}

async function resetClient(client) {
  try {
    await client.query('RESET ALL');
  } catch {
    // Connection may already be closed.
  }
}

async function withRls(req, fn) {
  const dbPool = ensurePool();
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify(rlsClaimsFor(req)),
    ]);
    if (req && req.user && req.user.id) {
      await client.query('SET LOCAL ROLE authenticated');
    } else {
      await client.query('SET LOCAL ROLE anon');
    }
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    await resetClient(client);
    client.release();
  }
}

async function query(req, text, params = []) {
  return withRls(req, (client) => client.query(text, params));
}

async function withTransaction(req, fn) {
  return withRls(req, fn);
}

async function queryHealth() {
  return ensurePool().query('select 1 as ok');
}

module.exports = {
  pool: () => ensurePool(),
  query, withTransaction, withRls, makePool, queryHealth, rlsClaimsFor,
  sslOption,
};
