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

// Drop-in fetch wrapper that fires a global 'shop-not-configured' event when
// the API signals the user hasn't completed onboarding. Use in place of
// fetch(apiUrl(...)) for automatic global handling.
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
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
