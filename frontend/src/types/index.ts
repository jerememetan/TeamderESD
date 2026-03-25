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
  groupId: string;
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

export interface TeamMember extends Student {
  confirmationStatus: 'confirmed' | 'pending';
}

export interface Team {
  id: string;
  courseId: string;
  groupId: string;
  name: string;
  members: TeamMember[];
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
  groupId?: string;
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

export interface PeerEvaluationRound {
  id: string;
  courseId: string;
  groupId: string;
  status: 'draft' | 'active' | 'closed';
  title: string;
  startedAt: string;
  dueAt: string;
  eligibleStudentEmails: string[];
  teamIds: string[];
}

export interface PeerEvaluationEntry {
  memberEmail: string;
  memberName: string;
  rating: number;
  justification: string;
}

export interface PeerEvaluationSubmission {
  id: string;
  roundId: string;
  studentEmail: string;
  teamId: string;
  entries: PeerEvaluationEntry[];
  submittedAt: string;
  privateReputationSignal: number;
}

