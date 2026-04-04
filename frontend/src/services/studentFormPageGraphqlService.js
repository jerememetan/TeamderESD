const GRAPHQL_URL =
  import.meta.env.VITE_GRAPHQL_URL ?? "http://localhost:8000/graphql";

const STUDENT_FORM_PAGE_QUERY = `
  query StudentFormPage($studentId: ID!, $sectionId: ID!) {
    studentFormPage(studentId: $studentId, sectionId: $sectionId) {
      student {
        studentId
        name
      }
      sectionId
      submitted
      fieldVisibility {
        mbtiEnabled
        buddyEnabled
        buddyWeight
        skillEnabled
        topicEnabled
      }
      formFields {
        fieldKey
        label
        inputType
        required
        options {
          value
          label
        }
      }
      skillCatalog {
        value
        label
      }
      topicCatalog {
        value
        label
      }
      buddyOptions {
        value
        label
      }
    }
  }
`;

const STUDENT_FORM_ASSIGNMENTS_QUERY = `
  query StudentFormAssignments($studentId: ID!) {
    studentFormAssignments(studentId: $studentId) {
      id
      sectionId
      submitted
      title
      description
    }
  }
`;

async function postGraphql(query, variables) {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const rawBody = await response.text();
  let payload = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = { raw: rawBody };
  }

  if (!response.ok) {
    throw new Error(
      payload?.errors?.[0]?.message ||
        payload?.error?.message ||
        payload?.error ||
        (typeof payload?.raw === "string" ? payload.raw.slice(0, 200) : "") ||
        `GraphQL request failed with status ${response.status}`,
    );
  }

  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(payload.errors[0]?.message || "GraphQL query failed.");
  }

  return payload?.data;
}

export async function fetchStudentFormPage({ studentId, sectionId }) {
  const safeStudentId = String(studentId ?? "").trim();
  const safeSectionId = String(sectionId ?? "").trim();

  if (!safeStudentId) {
    throw new Error("studentId is required");
  }
  if (!safeSectionId) {
    throw new Error("sectionId is required");
  }

  const data = await postGraphql(STUDENT_FORM_PAGE_QUERY, {
    studentId: safeStudentId,
    sectionId: safeSectionId,
  });

  return data?.studentFormPage ?? null;
}

export async function fetchStudentFormAssignments({ studentId }) {
  const safeStudentId = String(studentId ?? "").trim();
  if (!safeStudentId) {
    throw new Error("studentId is required");
  }

  const data = await postGraphql(STUDENT_FORM_ASSIGNMENTS_QUERY, {
    studentId: safeStudentId,
  });

  const assignments = data?.studentFormAssignments;
  if (!Array.isArray(assignments)) {
    return [];
  }

  return assignments
    .map((assignment, index) => ({
      id: String(assignment?.id ?? "").trim(),
      sectionId: String(assignment?.sectionId ?? "").trim(),
      submitted: Boolean(assignment?.submitted),
      title:
        String(assignment?.title ?? "").trim() ||
        `Form ${index + 1}`,
      description:
        String(assignment?.description ?? "").trim() || "Course form",
    }))
    .filter((assignment) => Boolean(assignment.id));
}
