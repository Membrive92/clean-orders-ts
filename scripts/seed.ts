/**
 * Database Seeding Script
 * Populate database with sample data
 */

import { DatabaseFactory } from '../src/infrastructure/database/DatabaseFactory.js';
import { PinoLogger } from '../src/infrastructure/loggin/PinoLogger.js';

const logger = new PinoLogger({ level: 'info' });

async function seed() {
  try {
    logger.info('🌱 Starting database seeding...');
    
    await DatabaseFactory.seedDatabase();
    
    logger.info('✅ Seeding completed successfully!');
    
    // Show database stats
    const stats = await DatabaseFactory.getDatabaseStats();
    logger.info('📊 Database statistics:', stats);
    
    await DatabaseFactory.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', { error });
    await DatabaseFactory.close();
    process.exit(1);
  }
}

seed();
