import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  getAdminEnv,
  readAdminUpstreamResponse,
  verifyAdminToken,
} from '../../../../lib/adminAuth';

export async function GET(request) {
  const env = getAdminEnv();
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  const payload = await verifyAdminToken(token, env.secret);

  if (!payload) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const search = request.nextUrl.searchParams.get('search') || '';
  const status = request.nextUrl.searchParams.get('status') || 'all';
  const url = new URL('/api/admin/shops', env.apiBaseUrl);
  url.searchParams.set('status', status);
  if (search) url.searchParams.set('search', search);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const { status: upstreamStatus, data } = await readAdminUpstreamResponse(response, 'Unable to load shop list.');
  return NextResponse.json(data, { status: upstreamStatus });
}
