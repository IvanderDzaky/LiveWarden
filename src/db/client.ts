import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
pool.on('error', (error) => console.error(JSON.stringify({ event: 'database_pool_error', error: error.message })));
export const db = drizzle(pool, { schema });
