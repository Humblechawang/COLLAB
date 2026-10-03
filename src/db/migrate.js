// Minimal migration runner. For a growing project, replace with a real tool
// (node-pg-migrate, Prisma Migrate, Flyway) — this exists so the schema can
// be applied with zero extra dependencies on a fresh database.
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');
const logger = require('../config/logger');

async function main() {
  await pool.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const dir = path.join(__dirname, '..', '..', '..', 'database', 'migrations');
  const baseline = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');

  const already = await pool.query('select name from _migrations');
  const done = new Set(already.rows.map((r) => r.name));

  if (!done.has('000_schema.sql') && fs.existsSync(baseline)) {
    logger.info('Applying baseline schema.sql');
    await pool.query(fs.readFileSync(baseline, 'utf8'));
    await pool.query('insert into _migrations (name) values ($1)', ['000_schema.sql']);
  }

  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      logger.info({ file }, 'Applying migration');
      await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await pool.query('insert into _migrations (name) values ($1)', [file]);
    }
  }

  logger.info('Migrations complete');
  await pool.end();
}

main().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
