const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../config/logger');

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      ...(config.isProdLike ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: config.isProdLike
    ? { maxAge: 15552000, includeSubDomains: true, preload: true }
    : false,
});

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.cors.origins.includes(origin)) return callback(null, true);
    logger.warn({ origin }, 'Blocked CORS request from unlisted origin');
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});

const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Try again later.' },
});

const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many invitations sent. Try again in an hour.' },
});

function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const logPayload = {
    reqId: req.id,
    path: req.path,
    status,
    err: { name: err.name, message: err.message },
  };
  if (!config.isProdLike && err.stack) logPayload.err.stack = err.stack;
  logger.error(logPayload, 'Request failed');

  if (status >= 500) {
    return res.status(500).json({ error: 'Something went wrong. Please try again.', requestId: req.id });
  }
  return res.status(status).json({ error: err.publicMessage || err.message || 'Request failed', requestId: req.id });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found', requestId: req.id });
}

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  generalLimiter,
  authLimiter,
  inviteLimiter,
  requestId,
  errorHandler,
  notFound,
};
