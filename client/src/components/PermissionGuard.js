'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasPermission, isOwner } from '../lib/permissions';

/**
 * Renders children only if the current user has the required permission.
 *
 * Props:
 *   permission  — single permission string (e.g. 'MANAGE_USERS')
 *   ownerOnly   — if true, only renders for the shop owner
 *   fallback    — element to render when access is denied (default: null)
 *   redirect    — path to redirect to when access is denied (optional)
 */
export default function PermissionGuard({ permission, ownerOnly = false, fallback = null, redirect, children }) {
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const ok = ownerOnly ? isOwner() : (!permission || hasPermission(permission));
    setAllowed(ok);
    setChecked(true);
    if (!ok && redirect) router.replace(redirect);
  }, [permission, ownerOnly, redirect, router]);

  if (!checked) return null;
  if (!allowed) return fallback;
  return children;
}

/**
 * Lightweight inline guard — renders nothing (no redirect) if denied.
 * Useful for hiding individual buttons or UI elements.
 */
export function Can({ permission, ownerOnly = false, children }) {
  if (typeof window === 'undefined') return null; // SSR safe
  const ok = ownerOnly ? isOwner() : (!permission || hasPermission(permission));
  return ok ? children : null;
}
