const express = require('express');
const cookieParser = require('cookie-parser');
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

const app = express();

// Trust exactly one reverse proxy hop (set by your load balancer / Nginx).
// Required for req.ip and rate limiting to see the real client IP instead
// of the proxy's address, without letting a client spoof X-Forwarded-For.
app.set('trust proxy', 1);

app.use(requestId);
app.use(pinoHttp({ logger, genReqId: (req) => req.id }));
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' })); // small limit: this API never needs large JSON bodies
app.use(cookieParser());
app.use(generalLimiter);

app.get('/healthz', (req, res) => res.json({ ok: true, env: config.isProd ? 'production' : 'development' }));

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/teams', memberRoutes);
app.use('/api/teams', inviteRoutes);
app.use('/api/teams', postRoutes);
app.use('/api/teams', workRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Collab API listening on port ${config.port} (${config.isProd ? 'production' : 'development'})`);
});

// Graceful shutdown: stop accepting new connections, let in-flight requests
// finish, then exit — so a deploy never cuts off a request mid-write.
function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
