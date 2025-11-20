import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

console.log('Attempting to connect with:', process.env.DATABASE_URL);

try {
  const client = await pool.connect();
  console.log('✅ Connected successfully!');
  const result = await client.query('SELECT current_database(), current_user;');
  console.log('Database:', result.rows[0]);
  client.release();
  await pool.end();
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
}
