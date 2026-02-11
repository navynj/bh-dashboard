/**
 * Decrypt QuickBooks tokens encrypted by bhpnl (AES-256-GCM).
 * Use when syncing refresh_token from bhpnl's DB: set QUICKBOOKS_ENCRYPTION_KEY
 * to the same value as bhpnl and store the encrypted string; we decrypt at use time.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.QUICKBOOKS_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error('QUICKBOOKS_ENCRYPTION_KEY is not set');
  }
  if (keyEnv.length === 44) {
    try {
      return Buffer.from(keyEnv, 'base64');
    } catch {
      // fall through to passphrase
    }
  }
  const salt =
    process.env.QUICKBOOKS_ENCRYPTION_SALT || 'default-salt-change-in-production';
  return crypto.pbkdf2Sync(keyEnv, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Check if a string looks like bhpnl-encrypted data (base64, long enough).
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  try {
    const decoded = Buffer.from(data, 'base64');
    return decoded.length >= IV_LENGTH + SALT_LENGTH + TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Decrypt a refresh token or realmId encrypted by bhpnl.
 * If QUICKBOOKS_ENCRYPTION_KEY is not set or data is not encrypted, returns the input.
 */
export function decryptRefreshToken(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  if (!process.env.QUICKBOOKS_ENCRYPTION_KEY) return encryptedData;
  if (!isEncrypted(encryptedData)) return encryptedData;

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');
    if (combined.length < IV_LENGTH + SALT_LENGTH + TAG_LENGTH + 1) {
      return encryptedData;
    }
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(
      IV_LENGTH + SALT_LENGTH,
      IV_LENGTH + SALT_LENGTH + TAG_LENGTH,
    );
    const encrypted = combined.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return encryptedData;
  }
}
