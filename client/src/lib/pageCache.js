const CACHE_VERSION = 'v1';

function getUserNamespace() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user?.username || user?.id || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

export function getPageCacheKey(key) {
  return `page-cache:${CACHE_VERSION}:${getUserNamespace()}:${key}`;
}

export function readPageCache(key) {
  try {
    const raw = localStorage.getItem(getPageCacheKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writePageCache(key, value) {
  try {
    localStorage.setItem(
      getPageCacheKey(key),
      JSON.stringify({
        ...value,
        cachedAt: new Date().toISOString(),
      })
    );
  } catch {}
}

export function scheduleDeferred(callback, delay = 120) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: 1000 });
  }
  return window.setTimeout(callback, delay);
}

export function cancelDeferred(id) {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
    return;
  }
  clearTimeout(id);
}
