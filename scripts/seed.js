// Optional: populates a fresh local database with one team and one owner
// account, so you have something to look at after `docker compose up`.
// This never runs automatically and never runs in production.
require('dotenv').config();
const db = require('../src/db/pool');
const { hashPassword } = require('../src/middleware/auth');

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed a production database.');
    process.exit(1);
  }

  const email = 'founder@example.com';
  const passwordHash = await hashPassword('ChangeMe!2026');

  const { rows: userRows } = await db.query(
    `insert into users (email, password_hash, full_name, bio)
     values ($1, $2, 'Founding Member', 'Building in public.')
     on conflict (email) do update set full_name = excluded.full_name
     returning id`,
    [email, passwordHash],
  );
  const userId = userRows[0].id;

  const { rows: teamRows } = await db.query(
    `insert into teams (slug, name, tagline, created_by)
     values ('your-team', 'Your Team', 'Replace this with your real tagline.', $1)
     on conflict (slug) do nothing
     returning id`,
    [userId],
  );
  if (teamRows[0]) {
    await db.query(
      `insert into members (team_id, user_id, role) values ($1, $2, 'owner')
       on conflict do nothing`,
      [teamRows[0].id, userId],
    );
  }

  console.log(`Seeded ${email} / ChangeMe!2026 — change this password immediately.`);
  await db.pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
