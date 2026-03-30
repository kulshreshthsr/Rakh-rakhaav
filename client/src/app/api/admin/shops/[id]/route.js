import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  getAdminEnv,
  readAdminUpstreamResponse,
  verifyAdminToken,
} from '../../../../../lib/adminAuth';

export async function DELETE(request, context) {
  const env = getAdminEnv();
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  const payload = await verifyAdminToken(token, env.secret);
  const resolvedParams = await context?.params;
  const shopId = resolvedParams?.id || request.nextUrl.pathname.split('/').filter(Boolean).pop();

  if (!payload) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (!shopId) {
    return NextResponse.json({ message: 'Shop id missing' }, { status: 400 });
  }

  const response = await fetch(new URL(`/api/admin/shops/${shopId}`, env.apiBaseUrl), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const { status, data } = await readAdminUpstreamResponse(response, 'Unable to remove user.');
  return NextResponse.json(data, { status });
}
