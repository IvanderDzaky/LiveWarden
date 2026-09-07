import { db } from '../db/client.js';
import { acknowledgeAlert } from './alert-repository.js';

export const acknowledgeAlertForUser = (alertId: string, userId: string, note: string | null = null, acknowledgedAt = new Date()) =>
  db.transaction((tx) => acknowledgeAlert(tx, alertId, userId, acknowledgedAt, note));
