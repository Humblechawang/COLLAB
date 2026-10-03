const db = require('../db/pool');

/**
 * Loads the caller's membership row for :teamId and attaches it as req.membership.
 * This is the single chokepoint for "who can see and do what" — every route
 * that touches a team resource must call this, never trust a client-sent role.
 */
function loadMembership() {
  return async (req, res, next) => {
    try {
      const teamId = req.params.teamId || req.body.teamId;
      if (!teamId) {
        const err = new Error('Team context required.');
        err.status = 400;
        return next(err);
      }
      if (req.user) {
        const { rows } = await db.query(
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

/** Requires the caller to be any member (owner, admin, or member) of the team. */
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

/** Requires the caller to hold one of the given roles. */
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

/** For public-read endpoints: allows the request through, but flags whether the team is public. */
async function requirePublicOrMember(req, res, next) {
  try {
    const { rows } = await db.query('select is_public from teams where id = $1', [req.teamId]);
    const team = rows[0];
    if (!team) {
      const err = new Error('Team not found.');
      err.status = 404;
      return next(err);
    }
    if (team.is_public || req.membership) return next();
    const err = new Error('This team page is private.');
    err.status = 403;
    next(err);
  } catch (err) {
    next(err);
  }
}

module.exports = { loadMembership, requireMember, requireRole, requirePublicOrMember };
