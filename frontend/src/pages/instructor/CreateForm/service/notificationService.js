const NOTIFICATION_API_BASE =
  import.meta.env.VITE_FORMATION_NOTIFICATION_API_BASE ??
  "http://localhost:8000/formation-notifications";

async function parseJson(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function handleResponse(response, fallbackMessage) {
  const payload = await parseJson(response);

  if (!response.ok) {
    const message = payload.error || payload.message || fallbackMessage;
    throw new Error(message);
  }

  return payload;
}

export async function sendFormLinks(payload) {
  const response = await fetch(`${NOTIFICATION_API_BASE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response, "Failed to generate or send form links.");
}

export default {
  sendFormLinks,
};
