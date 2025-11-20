import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import pg from 'pg';
import { config } from '../src/composition/config.js';

const { Pool } = pg;

interface MigrationFile {
  filename: string;
  path: string;
}

async function getMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = join(process.cwd(), 'db', 'migrations');
  
  try {
    const files = await readdir(migrationsDir);
    
    // Filter only .sql files and sort them alphabetically
    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(filename => ({
        filename,
        path: join(migrationsDir, filename)
      }));
    
    return sqlFiles;
  } catch (error) {
    console.error('Error reading migrations directory:', error);
    throw error;
  }
}

async function executeMigration(pool: pg.Pool, migration: MigrationFile): Promise<void> {
  console.log(`\n📄 Executing migration: ${migration.filename}`);
  
  try {
    let sql = await readFile(migration.path, 'utf-8');
    
    // Remove BOM if present (common in Windows)
    if (sql.charCodeAt(0) === 0xFEFF) {
      sql = sql.substring(1);
    }
    
    // Execute the SQL file content
    await pool.query(sql);
    
    console.log(`✅ Migration ${migration.filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Error executing migration ${migration.filename}:`, error);
    throw error;
  }
}

async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
  });

  try {
    console.log('🚀 Starting database migrations...\n');
    console.log(`📦 Database: ${config.DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);
    
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established\n');
    
    // Get all migration files
    const migrations = await getMigrationFiles();
    
    if (migrations.length === 0) {
      console.log('⚠️  No migration files found in db/migrations/');
      return;
    }
    
    console.log(`📋 Found ${migrations.length} migration file(s):`);
    migrations.forEach(m => console.log(`   - ${m.filename}`));
    
    // Execute migrations in order
    for (const migration of migrations) {
      await executeMigration(pool, migration);
    }
    
    console.log('\n✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations();
