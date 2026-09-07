import { config } from '../config.js';
import { pool } from './client.js';

const applicationTables = [
  'integration_deliveries',
  'ai_summaries',
  'alert_acknowledgements',
  'alerts',
  'events',
  'monitoring_snapshots',
  'live_sessions',
  'streams',
  'auth_sessions',
  'users'
];

try {
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to truncate database when NODE_ENV=production');
  }
  await pool.query(`TRUNCATE ${applicationTables.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`LiveWarden application data truncated: ${applicationTables.join(', ')}`);
} finally {
  await pool.end();
}
