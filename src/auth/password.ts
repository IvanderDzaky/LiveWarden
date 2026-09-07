import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
const scrypt = (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) =>
  new Promise<Buffer>((resolve, reject) => scryptCallback(password, salt, keylen, options, (error, derived) => error ? reject(error) : resolve(derived as Buffer)));
const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt.toString('base64url')}$${derived.toString('base64url')}`;
};

export const verifyPassword = async (password: string, encoded: string) => {
  try {
    const [algorithm, n, r, p, saltText, hashText] = encoded.split('$');
    if (algorithm !== 'scrypt' || !n || !r || !p || !saltText || !hashText) return false;
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (!salt.length || expected.length !== KEY_LENGTH) return false;
    const actual = await scrypt(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
};
