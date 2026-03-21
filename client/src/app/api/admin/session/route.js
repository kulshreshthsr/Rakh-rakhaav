import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getAdminEnv, verifyAdminToken } from '../../../../lib/adminAuth';

export async function GET() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  const payload = await verifyAdminToken(token, getAdminEnv().secret);

  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    admin: {
      username: payload.username,
      role: payload.role,
    },
  });
}
