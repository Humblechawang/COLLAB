const db = require('../db/pool');
const { sha256 } = require('../middleware/auth');

async function logAction({ actorId, teamId, action, target, metadata, ip }) {
  await db.query(
    `insert into audit_log (actor_id, team_id, action, target, metadata, ip_hash)
     values ($1, $2, $3, $4, $5, $6)`,
    [actorId || null, teamId || null, action, target || null, metadata ? JSON.stringify(metadata) : null, ip ? sha256(ip) : null],
  );
}

module.exports = { logAction };
