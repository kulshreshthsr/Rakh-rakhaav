import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  createAdminToken,
  getAdminEnv,
  getMissingAdminEnvKeys,
} from '../../../../lib/adminAuth';

function safeCompare(expected, received) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function POST(request) {
  const env = getAdminEnv();
  const { username, password, secret } = env;
  const missingKeys = getMissingAdminEnvKeys(env);

  if (missingKeys.length > 0) {
    return NextResponse.json(
      {
        message: `Admin login is not configured. Missing ${missingKeys.join(', ')} in client/.env.local.`,
        missingKeys,
      },
      { status: 500 }
    );
  }

  const body = await request.json();
  const inputUsername = String(body.username || '').trim();
  const inputPassword = String(body.password || '');

  if (!safeCompare(username, inputUsername) || !safeCompare(password, inputPassword)) {
    return NextResponse.json({ message: 'Invalid admin credentials.' }, { status: 401 });
  }

  const token = await createAdminToken({ role: 'admin', username }, secret);
  const response = NextResponse.json({ ok: true, username });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return response;
}
