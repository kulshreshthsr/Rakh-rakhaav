export const ADMIN_COOKIE_NAME = 'rk_admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function getAdminEnv() {
  return {
    username: process.env.ADMIN_USERNAME || '',
    password: process.env.ADMIN_PASSWORD || '',
    secret: process.env.ADMIN_JWT_SECRET || '',
    apiBaseUrl: process.env.ADMIN_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  };
}

export function getMissingAdminEnvKeys(env = getAdminEnv()) {
  const missing = [];

  if (!env.username) missing.push('ADMIN_USERNAME');
  if (!env.password) missing.push('ADMIN_PASSWORD');
  if (!env.secret) missing.push('ADMIN_JWT_SECRET');

  return missing;
}

function toBase64Url(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(input);
  let binary = '';

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function createSignature(unsignedToken, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsignedToken));
  return toBase64Url(new Uint8Array(signature));
}

export async function createAdminToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const completePayload = {
    ...payload,
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE,
  };

  const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(completePayload))}`;
  const signature = await createSignature(unsignedToken, secret);
  return `${unsignedToken}.${signature}`;
}

export async function verifyAdminToken(token, secret) {
  if (!token || !secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signature] = parts;
  const unsignedToken = `${headerPart}.${payloadPart}`;
  const expectedSignature = await createSignature(unsignedToken, secret);
  if (signature !== expectedSignature) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerPart)));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart)));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    if (payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}
