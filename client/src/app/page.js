'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasTrialGateSeen, hasWelcomePending, readStoredSubscription } from '../lib/subscription';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (hasWelcomePending()) {
      router.push('/welcome');
      return;
    }

    const subscription = readStoredSubscription();
    if (subscription && !subscription.isPro && !hasTrialGateSeen()) {
      router.push('/trial-status');
      return;
    }

    router.push('/dashboard');
  }, [router]);
  return null;
}
