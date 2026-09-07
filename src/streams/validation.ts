import { z } from 'zod';

const identifier = z.string().trim().min(1).max(100).refine((value) => !value.startsWith('@') && !/[\s\p{C}]/u.test(value) && /^[A-Za-z0-9._-]+$/.test(value), 'Invalid identifier');
const identifierInput = z.string().trim().min(1).max(101).transform((value) => value.startsWith('@') ? value.slice(1) : value).pipe(identifier);
const name = z.string().trim().min(1).max(200);

export const createStreamSchema = z.object({ name, platform: z.literal('TIKTOK_LIVE'), identifier: identifierInput }).strict();
export const updateStreamSchema = z.object({ name: name.optional(), platform: z.literal('TIKTOK_LIVE').optional(), identifier: identifierInput.optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const monitoringSchema = z.object({ enabled: z.boolean() }).strict();
