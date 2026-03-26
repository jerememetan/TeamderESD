export const backendCourseIds = {
  '1': '11111111-1111-1111-1111-111111111111',
  '2': '22222222-2222-2222-2222-222222222222',
  '3': '33333333-3333-3333-3333-333333333333',
};

export const backendSectionIds = {
  '1-g1': '22222222-2222-2222-2222-222222222222',
  '1-g2': '11111111-1111-1111-1111-111111111212',
  '2-g1': '22222222-2222-2222-2222-222222222221',
  '2-g2': '22222222-2222-2222-2222-222222222222',
  '3-g1': '33333333-3333-3333-3333-333333333331',
  '3-g2': '33333333-3333-3333-3333-333333333332',
};

export const backendStudentIds = {
  s1: 12,
};

export function getBackendCourseId(courseId) {
  return backendCourseIds[courseId] ?? null;
}

export function getBackendSectionId(groupId) {
  return backendSectionIds[groupId] ?? null;
}

export function getBackendStudentId(studentId) {
  return backendStudentIds[studentId] ?? null;
}


