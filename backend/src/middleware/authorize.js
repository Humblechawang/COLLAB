const db = require('../db/pool');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireTeamId() {
  return (req, res, next) => {
    const teamId = req.params.teamId;
    if (!teamId || !UUID_RE.test(teamId)) {
      const err = new Error('Team context required.');
      err.status = 400;
      return next(err);
    }
    req.teamId = teamId;
    next();
  };
}

function loadMembership() {
  return async (req, res, next) => {
    try {
      const teamId = req.params.teamId;
      if (!teamId || !UUID_RE.test(String(teamId))) {
        const err = new Error('Team context required.');
        err.status = 400;
        return next(err);
      }
      if (req.user) {
        const { rows } = await db.query(
          req,
          'select role from members where team_id = $1 and user_id = $2',
          [teamId, req.user.id],
        );
        req.membership = rows[0] || null;
      } else {
        req.membership = null;
      }
      req.teamId = teamId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requireMember() {
  return (req, res, next) => {
    if (!req.membership) {
      const err = new Error('You are not a member of this team.');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.membership || !roles.includes(req.membership.role)) {
      const err = new Error('You do not have permission to do that.');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

async function requirePublicOrMember(req, res, next) {
  try {
    const { rows } = await db.query(req, 'select is_public from teams where id = $1', [req.teamId]);
    const team = rows[0];
    if (!team) {
      const err = new Error('Team not found.');
      err.status = 404;
      return next(err);
    }
    if (team.is_public || req.membership) return next();
    const err = new Error('Team not found.');
    err.status = 404;
    next(err);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loadMembership, requireMember, requireRole, requirePublicOrMember, requireTeamId, UUID_RE,
};
