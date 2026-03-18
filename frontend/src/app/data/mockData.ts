import { Course, TeamForm, Team, SwapRequest, Student } from '../types/index';

export const mockCourses: Course[] = [
  {
    id: '1',
    name: 'Software Engineering',
    code: 'CS3240',
    semester: 'Fall 2026',
    groups: [
      {
        id: '1-g1',
        code: 'CS3240G1',
        label: 'Group 1',
        studentsCount: 60,
        teamsCount: 12,
        formStatus: 'active',
      },
      {
        id: '1-g2',
        code: 'CS3240G2',
        label: 'Group 2',
        studentsCount: 60,
        teamsCount: 12,
        formStatus: 'active',
      },
    ],
  },
  {
    id: '2',
    name: 'Database Systems',
    code: 'CS4320',
    semester: 'Fall 2026',
    groups: [
      {
        id: '2-g1',
        code: 'CS4320G1',
        label: 'Group 1',
        studentsCount: 40,
        teamsCount: 8,
        formStatus: 'closed',
      },
      {
        id: '2-g2',
        code: 'CS4320G2',
        label: 'Group 2',
        studentsCount: 40,
        teamsCount: 8,
        formStatus: 'active',
      },
    ],
  },
  {
    id: '3',
    name: 'Human-Computer Interaction',
    code: 'CS3250',
    semester: 'Fall 2026',
    groups: [
      {
        id: '3-g1',
        code: 'CS3250G1',
        label: 'Group 1',
        studentsCount: 30,
        teamsCount: 6,
        formStatus: 'draft',
      },
      {
        id: '3-g2',
        code: 'CS3250G2',
        label: 'Group 2',
        studentsCount: 30,
        teamsCount: 6,
        formStatus: 'draft',
      },
    ],
  },
];

export const mockForms: Record<string, TeamForm> = {
  '1': {
    id: 'form-1',
    courseId: '1',
    title: 'Team Formation Survey - Fall 2026',
    description: 'Please answer the following questions to help us form balanced teams for your project.',
    criteria: [
      {
        id: 'c1',
        question: 'What is your experience in Database?',
        type: 'multiple-choice',
        options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
        weight: 0.3,
      },
      {
        id: 'c2',
        question: 'Rate your teamwork skills (1-10)',
        type: 'scale',
        weight: 0.2,
      },
      {
        id: 'c3',
        question: 'What is your preferred work style?',
        type: 'multiple-choice',
        options: ['Individual focused', 'Collaborative', 'Leadership role', 'Flexible'],
        weight: 0.25,
      },
      {
        id: 'c4',
        question: 'What technical skills do you bring to a team?',
        type: 'text',
        weight: 0.25,
      },
    ],
    status: 'active',
    createdAt: '2026-03-01T10:00:00Z',
    responseCount: 95,
    totalStudents: 60,
  },
};

export const mockStudents: Student[] = [
  { id: 's1', name: 'Alice Johnson', email: 'alice@university.edu', studentId: 'STU001' },
  { id: 's2', name: 'Bob Smith', email: 'bob@university.edu', studentId: 'STU002' },
  { id: 's3', name: 'Carol Davis', email: 'carol@university.edu', studentId: 'STU003' },
  { id: 's4', name: 'David Wilson', email: 'david@university.edu', studentId: 'STU004' },
  { id: 's5', name: 'Emma Brown', email: 'emma@university.edu', studentId: 'STU005' },
];

export const mockTeams: Team[] = [
  {
    id: 't1',
    courseId: '1',
    groupId: '1-g1',
    name: 'Team Alpha',
    members: [mockStudents[0], mockStudents[1], mockStudents[2], mockStudents[3], mockStudents[4]],
    formationScore: 92,
    diversity: {
      skillLevel: 0.85,
      background: 0.78,
      workStyle: 0.91,
    },
  },
  {
    id: 't2',
    courseId: '1',
    groupId: '1-g1',
    name: 'Team Beta',
    members: [
      { id: 's6', name: 'Frank Miller', email: 'frank@university.edu', studentId: 'STU006' },
      { id: 's7', name: 'Grace Lee', email: 'grace@university.edu', studentId: 'STU007' },
      { id: 's8', name: 'Henry Chen', email: 'henry@university.edu', studentId: 'STU008' },
      { id: 's9', name: 'Iris Wang', email: 'iris@university.edu', studentId: 'STU009' },
      { id: 's10', name: 'Jack Taylor', email: 'jack@university.edu', studentId: 'STU010' },
    ],
    formationScore: 88,
    diversity: {
      skillLevel: 0.82,
      background: 0.89,
      workStyle: 0.84,
    },
  },
  {
    id: 't3',
    courseId: '1',
    groupId: '1-g2',
    name: 'Team Gamma',
    members: [
      { id: 's11', name: 'Kelly Martinez', email: 'kelly@university.edu', studentId: 'STU011' },
      { id: 's12', name: 'Leo Anderson', email: 'leo@university.edu', studentId: 'STU012' },
      { id: 's13', name: 'Maya Patel', email: 'maya@university.edu', studentId: 'STU013' },
      { id: 's14', name: 'Nathan Kim', email: 'nathan@university.edu', studentId: 'STU014' },
      { id: 's15', name: 'Olivia Garcia', email: 'olivia@university.edu', studentId: 'STU015' },
    ],
    formationScore: 95,
    diversity: {
      skillLevel: 0.93,
      background: 0.87,
      workStyle: 0.95,
    },
  },
];

export const mockSwapRequests: SwapRequest[] = [
  {
    id: 'sr1',
    courseId: '1',
    courseName: 'Software Engineering',
    studentId: 's2',
    studentName: 'Bob Smith',
    currentTeamId: 't1',
    currentTeamName: 'Team Alpha',
    targetTeamId: 't2',
    targetTeamName: 'Team Beta',
    reason: 'I have a better skill match with Team Beta members and share similar project interests.',
    status: 'pending',
    createdAt: '2026-03-12T14:30:00Z',
  },
  {
    id: 'sr2',
    courseId: '2',
    courseName: 'Database Systems',
    studentId: 's20',
    studentName: 'Sarah Johnson',
    currentTeamId: 't10',
    currentTeamName: 'Team Delta',
    targetTeamId: 't11',
    targetTeamName: 'Team Epsilon',
    reason: 'Schedule conflicts with current team meetings.',
    status: 'pending',
    createdAt: '2026-03-11T09:15:00Z',
  },
];

// Mock current student (for student view)
export const currentStudent: Student = {
  id: 's1',
  name: 'Alice Johnson',
  email: 'alice@university.edu',
  studentId: 'STU001',
};

export const currentStudentTeam = mockTeams[0];
