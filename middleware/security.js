const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../config/logger');

// --- Helmet: strict security headers, no inline script/style allowances ---
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
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
});

// --- CORS: explicit allowlist, credentials only for known origins ---
const corsMiddleware = cors({
  origin(origin, callback) {
    // Allow same-origin / server-to-server calls with no Origin header.
    if (!origin) return callback(null, true);
    if (config.cors.origins.includes(origin)) return callback(null, true);
    logger.warn({ origin }, 'Blocked CORS request from unlisted origin');
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
});

// --- Rate limiting ---
// General API traffic.
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Tighter limit on auth endpoints to blunt credential stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Try again later.' },
});

// Separate, stricter limit for invite creation to stop invite-spam abuse.
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many invitations sent. Try again in an hour.' },
});

// --- Request ID for tracing ---
function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

// --- Centralized error handler: never leak stack traces or internals ---
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  logger.error({ err, reqId: req.id, path: req.path }, 'Request failed');

  if (status >= 500) {
    // Never expose internal error detail to the client.
    return res.status(500).json({ error: 'Something went wrong. Please try again.', requestId: req.id });
  }
  return res.status(status).json({ error: err.publicMessage || err.message || 'Request failed', requestId: req.id });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
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
