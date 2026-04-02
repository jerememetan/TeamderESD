const ERROR_LOG_URL = import.meta.env.VITE_ERROR_LOG_URL ?? 'http://localhost:3019/errors';

async function parseJson(response) {
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

async function handleResponse(response, fallbackMessage) {
  const payload = await parseJson(response);

  if (!response.ok) {
    const message = payload?.error?.message || payload.message || fallbackMessage;
    throw new Error(message);
  }

  return payload;
}

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

  const response = await fetch(`${ERROR_LOG_URL}?${searchParams.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await handleResponse(response, 'Unable to load error logs.');
  return payload?.data ?? [];
}

export async function deleteErrorLog(errorId) {
  const response = await fetch(`${ERROR_LOG_URL}/${errorId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = await handleResponse(response, 'Unable to delete error log.');
  return payload?.data ?? null;
}