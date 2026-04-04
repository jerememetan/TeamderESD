import { fetchJson } from "./httpClient";

const STUDENT_FORM_URL = import.meta.env.VITE_STUDENT_FORM_URL ?? "http://localhost:8000/student-form";

function normalizeStudentForm(record) {
  return {
    id: String(record?.id ?? ""),
    sectionId: record?.section_id ?? record?.sectionId ?? "",
    studentId: record?.student_id ?? record?.studentId ?? null,
    submitted: Boolean(record?.submitted),
    raw: record,
  };
}

function extractForms(payload) {
  const candidates = payload?.data ?? payload;
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates.map(normalizeStudentForm).filter((form) => Boolean(form.id));
}

export async function fetchStudentForms({ studentId, sectionId }) {
  const params = new URLSearchParams();
  if (studentId !== undefined && studentId !== null && String(studentId).trim()) {
    params.set("student_id", String(studentId));
  }
  if (sectionId !== undefined && sectionId !== null && String(sectionId).trim()) {
    params.set("section_id", String(sectionId));
  }

  if (!params.toString()) {
    throw new Error("student_id or section_id is required");
  }

  const payload = await fetchJson(`${STUDENT_FORM_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });

  return extractForms(payload);
}

export async function fetchStudentFormById(formId) {
  const payload = await fetchJson(`${STUDENT_FORM_URL}/${encodeURIComponent(formId)}`, {
    headers: { Accept: "application/json" },
  });

  const form = payload?.data;
  return form ? normalizeStudentForm(form) : null;
}

function requireSectionId(sectionId) {
  if (sectionId === undefined || sectionId === null || !String(sectionId).trim()) {
    throw new Error("section_id is required");
  }
  return String(sectionId).trim();
}

export async function fetchSubmittedStudentFormsBySectionId(sectionId) {
  const safeSectionId = requireSectionId(sectionId);
  const payload = await fetchJson(
    `${STUDENT_FORM_URL}/submitted?section_id=${encodeURIComponent(safeSectionId)}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  return extractForms(payload);
}

export async function fetchUnsubmittedStudentFormsBySectionId(sectionId) {
  const safeSectionId = requireSectionId(sectionId);
  const payload = await fetchJson(
    `${STUDENT_FORM_URL}/unsubmitted?section_id=${encodeURIComponent(safeSectionId)}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  return extractForms(payload);
}
