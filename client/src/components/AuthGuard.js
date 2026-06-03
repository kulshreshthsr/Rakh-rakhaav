'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/pricing'];

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
      router.replace('/login');
    }
  }, [pathname, router]);

  return children;
}
