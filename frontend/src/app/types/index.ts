export interface CourseGroup {
  id: string;
  code: string;
  label: string;
  studentsCount: number;
  teamsCount: number;
  formStatus: 'draft' | 'active' | 'closed';
}

export interface Course {
  id: string;
  name: string;
  code: string;
  semester: string;
  groups: CourseGroup[];
}

export interface FormCriteria {
  id: string;
  question: string;
  type: 'multiple-choice' | 'scale' | 'text';
  options?: string[];
  weight: number;
}

export interface TeamForm {
  id: string;
  courseId: string;
  title: string;
  description: string;
  criteria: FormCriteria[];
  groupSize: number;
  minimumGroupSize?: number;
  mixGender: boolean;
  mixYear: boolean;
  allowBuddy: boolean;
  status: 'draft' | 'active' | 'closed';
  createdAt: string;
  responseCount: number;
  totalStudents: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  studentId: string;
}

export interface Team {
  id: string;
  courseId: string;
  groupId: string;
  name: string;
  members: Student[];
  formationScore: number;
  diversity: {
    skillLevel: number;
    background: number;
    workStyle: number;
  };
}

export interface SwapRequest {
  id: string;
  courseId: string;
  courseName: string;
  studentId: string;
  studentName: string;
  currentTeamId: string;
  currentTeamName: string;
  targetTeamId: string;
  targetTeamName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface FormResponse {
  id: string;
  studentId: string;
  formId: string;
  responses: Record<string, any>;
  submittedAt: string;
}
