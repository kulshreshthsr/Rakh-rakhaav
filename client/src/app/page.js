'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      window.location.href = '/dashboard';
    } else {
      window.location.href = '/login';
    }
  }, []);

  return null;
}