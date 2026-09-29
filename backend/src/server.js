const { createApp } = require('./app');
const config = require('./config');
const logger = require('./config/logger');

const app = createApp();

function logPrivilegeWarning() {
  try {
    const appUrl = new URL(config.db.url);
    const migrateUrl = new URL(config.db.migrateUrl);
    if (appUrl.host === migrateUrl.host && appUrl.port === migrateUrl.port) {
      logger.warn('Prefer DATABASE_URL = Supabase pooler (6543) and DATABASE_MIGRATE_URL = session/direct (5432).');
    }
  } catch {
    // Invalid URLs are handled when the pool connects.
  }
}

if (require.main === module) {
  logPrivilegeWarning();
  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, appEnv: config.appEnv }, 'Collab API listening');
  });

  function shutdown(signal) {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
