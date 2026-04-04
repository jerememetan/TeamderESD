const responseCache = new Map();
const inflightRequests = new Map();

function createCacheKey(method, url, cacheKey) {
  return cacheKey ?? `${method.toUpperCase()}:${url}`;
}

function readCachedValue(key) {
  const cachedEntry = responseCache.get(key);
  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return cachedEntry.value;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function toErrorMessage(payload, response) {
  return (
    payload?.error?.message ||
    payload?.error ||
    payload?.message ||
    `Request failed with status ${response.status}`
  );
}

export async function fetchJson(url, options = {}) {
  const {
    method = 'GET',
    headers,
    body,
    cache = true,
    ttlMs = 30000,
    cacheKey,
    signal,
  } = options;

  const normalizedMethod = method.toUpperCase();
  const key = createCacheKey(normalizedMethod, url, cacheKey);
  const cacheable = cache && normalizedMethod === 'GET';

  if (cacheable) {
    const cachedValue = readCachedValue(key);
    if (cachedValue !== null) {
      return cachedValue;
    }

    const inflight = inflightRequests.get(key);
    if (inflight) {
      return inflight;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(url, {
      method: normalizedMethod,
      headers,
      body,
      signal,
    });
    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new Error(toErrorMessage(payload, response));
    }

    if (cacheable) {
      responseCache.set(key, {
        expiresAt: Date.now() + ttlMs,
        value: payload,
      });
    }

    return payload;
  })();

  if (cacheable) {
    inflightRequests.set(key, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (cacheable) {
      inflightRequests.delete(key);
    }
  }
}

export function invalidateFetchCache(prefix = '') {
  if (!prefix) {
    responseCache.clear();
    inflightRequests.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }

  for (const key of inflightRequests.keys()) {
    if (key.startsWith(prefix)) {
      inflightRequests.delete(key);
    }
  }
}
