const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const pinoHttp = require('pino-http');
const config = require('./config');
const logger = require('./config/logger');
const {
  helmetMiddleware, corsMiddleware, generalLimiter,
  requestId, errorHandler, notFound,
} = require('./middleware/security');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const memberRoutes = require('./routes/members');
const inviteRoutes = require('./routes/invites');
const postRoutes = require('./routes/posts');
const workRoutes = require('./routes/work');

function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxyHops);

  app.use(requestId);
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    autoLogging: {
      ignore: (req) => req.url === '/healthz' || req.url === '/readyz',
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          remoteAddress: req.remoteAddress,
        };
      },
    },
  }));
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(generalLimiter);

  // Liveness: no dependency checks, no environment disclosure.
  app.get('/healthz', (req, res) => res.json({ ok: true }));

  // Readiness: verify the app can reach Postgres without leaking connection details.
  app.get('/readyz', async (req, res) => {
    try {
      const db = require('./db/pool');
      await db.queryHealth();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false, error: 'Dependency check failed.' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/teams', memberRoutes);
  app.use('/api/teams', inviteRoutes);
  app.use('/api/teams', postRoutes);
  app.use('/api/teams', workRoutes);

  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      err.status = 422;
      err.publicMessage = 'Upload rejected.';
    }
    next(err);
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
