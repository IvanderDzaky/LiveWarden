import 'dotenv/config';
import { pool } from './client.js';
import { pruneMonitoringSnapshots } from './retention.js';

try {
  console.log(`Deleted monitoring snapshots: ${await pruneMonitoringSnapshots()}`);
} finally {
  await pool.end();
}
