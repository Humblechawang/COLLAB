const crypto = require('crypto');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const config = require('../config');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

let jwks;

function getJwks() {
  if (!config.supabase.url) {
    throw new Error('SUPABASE_URL is not configured.');
  }
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${config.supabase.url}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

function extractAccessToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function isEmailConfirmed(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.email_confirmed === true || payload.email_verified === true) return true;
  if (payload.user_metadata && payload.user_metadata.email_verified === true) return true;
  if (payload.app_metadata && payload.app_metadata.email_verified === true) return true;
  return false;
}

function verifiedEmail(payload) {
  if (!isEmailConfirmed(payload)) return null;
  const email = payload.email || (payload.user_metadata && payload.user_metadata.email);
  return email ? String(email).toLowerCase() : null;
}

function isLiveEmailConfirmed(user) {
  return Boolean(user && user.email_confirmed_at);
}

async function fetchAuthUser(accessToken) {
  const res = await fetch(`${config.supabase.url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: config.supabase.publishableKey,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: config.supabase.issuer,
    audience: 'authenticated',
    algorithms: ['ES256', 'RS256'],
  });
  if (!payload.sub) {
    const err = new Error('Session expired. Please sign in again.');
    err.status = 401;
    throw err;
  }
  return payload;
}

function attachUser(req, payload, token) {
  req.accessToken = token;
  req.user = {
    id: payload.sub,
    email: verifiedEmail(payload),
    emailConfirmed: isEmailConfirmed(payload),
  };
}

function requireAuth(req, res, next) {
  const token = extractAccessToken(req);
  if (!token) {
    const err = new Error('Sign in required.');
    err.status = 401;
    return next(err);
  }
  verifyAccessToken(token)
    .then((payload) => {
      attachUser(req, payload, token);
      next();
    })
    .catch(() => {
      const err = new Error('Session expired. Please sign in again.');
      err.status = 401;
      next(err);
    });
}

function optionalAuth(req, res, next) {
  const token = extractAccessToken(req);
  if (!token) return next();
  verifyAccessToken(token)
    .then((payload) => {
      attachUser(req, payload, token);
      next();
    })
    .catch(() => {
      req.user = undefined;
      req.accessToken = undefined;
      next();
    });
}

function requireLiveConfirmedEmail(req, res, next) {
  if (!req.accessToken) {
    const err = new Error('Confirm your email before continuing.');
    err.status = 403;
    return next(err);
  }
  fetchAuthUser(req.accessToken)
    .then((user) => {
      if (!isLiveEmailConfirmed(user) || !user.email) {
        const err = new Error('Confirm your email before continuing.');
        err.status = 403;
        return next(err);
      }
      req.user.email = String(user.email).toLowerCase();
      req.user.emailConfirmed = true;
      req.authUser = user;
      next();
    })
    .catch(next);
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireConfirmedEmail: requireLiveConfirmedEmail,
  requireLiveConfirmedEmail,
  verifyAccessToken,
  isEmailConfirmed,
  isLiveEmailConfirmed,
  verifiedEmail,
  fetchAuthUser,
  sha256,
};
