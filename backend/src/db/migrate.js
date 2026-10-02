const fs = require('fs');
const path = require('path');
const { makePool } = require('./pool');
const { migrationDisposition } = require('./migration-policy');
const config = require('../config');
const logger = require('../config/logger');

async function main() {
  const migrateUrl = config.db.migrateUrl;
  if (!migrateUrl) {
    throw new Error('DATABASE_MIGRATE_URL is required (Supabase session/direct URI, not the pooler).');
  }

  const dir = path.join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const unreviewed = files.filter((file) => migrationDisposition(file) === 'unreviewed');
  if (unreviewed.length) {
    throw new Error(`Unreviewed migrations are blocked: ${unreviewed.join(', ')}`);
  }

  const pool = makePool(migrateUrl);
  try {
    await pool.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const already = await pool.query('select name from _migrations');
    const done = new Set(already.rows.map((r) => r.name));

    for (const file of files) {
      if (done.has(file)) continue;
      if (migrationDisposition(file) === 'hold') {
        logger.warn({ file }, 'Skipping historical migration held for a forward-only plan');
        continue;
      }
      logger.info({ file }, 'Applying migration');
      await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await pool.query('insert into _migrations (name) values ($1)', [file]);
    }

    logger.info('Migrations complete');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  logger.error({
    err: {
      name: err.name,
      message: err.message,
      code: err.code,
      cause: err.cause && { name: err.cause.name, message: err.cause.message, code: err.cause.code },
    },
  }, 'Migration failed');
  process.exit(1);
});
