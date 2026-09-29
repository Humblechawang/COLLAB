require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}
console.error('Seed is disabled. Create users in Supabase Auth, then call GET /api/auth/me to upsert profiles.');
process.exit(1);
