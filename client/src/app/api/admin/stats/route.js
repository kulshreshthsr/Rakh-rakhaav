import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  getAdminEnv,
  verifyAdminToken,
} from '../../../../lib/adminAuth';

export async function GET() {
  const env = getAdminEnv();
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  const payload = await verifyAdminToken(token, env.secret);

  if (!payload) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const response = await fetch(new URL('/api/admin/stats', env.apiBaseUrl), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
