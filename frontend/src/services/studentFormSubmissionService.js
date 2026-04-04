import { fetchJson } from "./httpClient";

const STUDENT_FORM_SUBMISSION_URL =
  import.meta.env.VITE_STUDENT_FORM_SUBMISSION_API_BASE ||
  "http://localhost:8000/student-form-submission";

export async function submitStudentForm(payload) {
  const response = await fetchJson(`${STUDENT_FORM_SUBMISSION_URL}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: false,
  });

  return response?.data ?? response;
}
