const REMOTE_API_URL = 'https://rakh-rakhaav.onrender.com';
const LOCAL_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function trimTrailingSlash(value = '') {
  return String(value).replace(/\/+$/, '');
}

export function getApiBaseUrl() {
  if (typeof window === 'undefined') {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL || REMOTE_API_URL);
  }

  const configuredBaseUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL || '');
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return trimTrailingSlash(LOCAL_API_URL);
  }

  return trimTrailingSlash(REMOTE_API_URL);
}

export function apiUrl(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

// Versioned helper — use for new code: v1Url('/products') → BASE/api/v1/products
export function v1Url(path = '') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}/api/v1${normalizedPath}`;
}

// ─── Refresh token logic ─────────────────────────────────────────────────────

let _refreshPromise = null; // serialises concurrent refresh calls

async function attemptTokenRefresh() {
  if (typeof window === 'undefined') return false;
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;
  try {
    const res = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      return true;
    }
  } catch {}
  return false;
}

// Drop-in fetch wrapper that:
// 1. Fires 'shop-not-configured' event when the API signals missing onboarding.
// 2. Automatically refreshes the access token on 401 and retries once.
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);

  if (res.status === 401 && typeof window !== 'undefined') {
    // Serialise concurrent refresh attempts into a single call
    if (!_refreshPromise) {
      _refreshPromise = attemptTokenRefresh().finally(() => { _refreshPromise = null; });
    }
    const refreshed = await _refreshPromise;
    if (refreshed) {
      // Retry original request with new token
      const newToken = localStorage.getItem('token');
      const retryOptions = { ...options, headers: { ...options.headers, Authorization: `Bearer ${newToken}` } };
      return fetch(url, retryOptions);
    }
    // Refresh failed — redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
    return res;
  }

  if (!res.ok && typeof window !== 'undefined') {
    const cloned = res.clone();
    try {
      const data = await cloned.json();
      if (data?.code === 'SHOP_NOT_CONFIGURED') {
        window.dispatchEvent(new CustomEvent('shop-not-configured', { detail: data.message }));
      }
    } catch {}
  }
  return res;
}
