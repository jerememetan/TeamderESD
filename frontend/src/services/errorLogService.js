import { fetchJson, invalidateFetchCache } from './httpClient';

const ERROR_LOG_URL = import.meta.env.VITE_ERROR_LOG_URL ?? 'http://localhost:8000/errors';

export async function fetchErrorLogs({ status, sourceService, page = 1, pageSize = 25 } = {}) {
  const searchParams = new URLSearchParams();

  searchParams.set('page', String(page));
  searchParams.set('page_size', String(pageSize));

  if (status && status !== 'all') {
    searchParams.set('status', status);
  }

  if (sourceService) {
    searchParams.set('source_service', sourceService);
  }

  const payload = await fetchJson(`${ERROR_LOG_URL}?${searchParams.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  return payload?.data ?? [];
}

export async function deleteErrorLog(errorId) {
  const payload = await fetchJson(`${ERROR_LOG_URL}/${errorId}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  invalidateFetchCache('GET:http://localhost:8000/errors');
  return payload?.data ?? null;
}