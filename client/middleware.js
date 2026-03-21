import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getAdminEnv, verifyAdminToken } from './src/lib/adminAuth';

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const payload = await verifyAdminToken(token, getAdminEnv().secret);
  const isLoginPage = pathname === '/admin/login';

  if (!payload && !isLoginPage) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  if (payload && isLoginPage) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
