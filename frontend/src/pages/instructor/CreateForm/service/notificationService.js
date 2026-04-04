import { fetchJson } from "../../../../services/httpClient";

const NOTIFICATION_API_BASE =
  import.meta.env.VITE_FORMATION_NOTIFICATION_API_BASE ??
  "http://localhost:8000/formation-notifications";

export async function sendFormLinks(payload) {
  try {
    return await fetchJson(`${NOTIFICATION_API_BASE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error("Failed to generate or send form links.");
  }
}

export default {
  sendFormLinks,
};
