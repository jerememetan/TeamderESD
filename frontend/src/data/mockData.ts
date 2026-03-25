import { Course, TeamForm, Team, SwapRequest, Student, TeamMember, PeerEvaluationRound, PeerEvaluationSubmission } from '../types';

const withStatus = (student: Student, confirmationStatus: 'confirmed' | 'pending'): TeamMember => ({
  ...student,
  confirmationStatus,
});

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
        formStatus: 'closed',
        lifecycleStage: 'formed',
      },
      {
        id: '1-g2',
        code: 'CS3240G2',
        label: 'Group 2',
        studentsCount: 60,
        teamsCount: 12,
        formStatus: 'closed',
        lifecycleStage: 'formed',
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
        teamsCount: 0,
        formStatus: 'active',
        lifecycleStage: 'collecting',
      },
      {
        id: '2-g2',
        code: 'CS4320G2',
        label: 'Group 2',
        studentsCount: 40,
        teamsCount: 8,
        formStatus: 'closed',
        lifecycleStage: 'completed',
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
        teamsCount: 0,
        formStatus: 'draft',
        lifecycleStage: 'setup',
      },
      {
        id: '3-g2',
        code: 'CS3250G2',
        label: 'Group 2',
        studentsCount: 30,
        teamsCount: 0,
        formStatus: 'draft',
        lifecycleStage: 'setup',
      },
    ],
  },
];

export const mockForms: Record<string, TeamForm> = {
  '1-g1': {
    id: 'form-1-g1',
    courseId: '1',
    groupId: '1-g1',
    title: 'Team Formation Survey - CS3240G1',
    description: 'Please answer the following questions to help us form balanced teams for CS3240G1.',
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
    groupSize: 5,
    minimumGroupSize: 4,
    mixGender: true,
    mixYear: true,
    allowBuddy: true,
    status: 'active',
    createdAt: '2026-03-01T10:00:00Z',
    responseCount: 48,
    totalStudents: 60,
  },
  '1-g2': {
    id: 'form-1-g2',
    courseId: '1',
    groupId: '1-g2',
    title: 'Team Formation Survey - CS3240G2',
    description: 'Please answer the following questions to help us form balanced teams for CS3240G2.',
    criteria: [
      {
        id: 'c1',
        question: 'What is your experience in frontend development?',
        type: 'multiple-choice',
        options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
        weight: 0.35,
      },
      {
        id: 'c2',
        question: 'Rate your teamwork skills (1-10)',
        type: 'scale',
        weight: 0.2,
      },
      {
        id: 'c3',
        question: 'What role do you naturally take in team projects?',
        type: 'multiple-choice',
        options: ['Planner', 'Builder', 'Tester', 'Flexible'],
        weight: 0.2,
      },
      {
        id: 'c4',
        question: 'What strengths would you contribute to this group?',
        type: 'text',
        weight: 0.25,
      },
    ],
    groupSize: 5,
    minimumGroupSize: 4,
    mixGender: true,
    mixYear: true,
    allowBuddy: true,
    status: 'active',
    createdAt: '2026-03-02T10:00:00Z',
    responseCount: 47,
    totalStudents: 60,
  },  '2-g1': {
    id: 'form-2-g1',
    courseId: '2',
    groupId: '2-g1',
    title: 'Team Formation Survey - CS4320G1',
    description: 'Please answer the following questions to help us form balanced teams for CS4320G1.',
    criteria: [
      {
        id: 'c1',
        question: 'How confident are you with schema design and normalization?',
        type: 'multiple-choice',
        options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
        weight: 0.35,
      },
      {
        id: 'c2',
        question: 'Rate your debugging skills (1-10)',
        type: 'scale',
        weight: 0.2,
      },
      {
        id: 'c3',
        question: 'Which role do you usually take in a database project?',
        type: 'multiple-choice',
        options: ['Designer', 'Builder', 'Tester', 'Flexible'],
        weight: 0.2,
      },
      {
        id: 'c4',
        question: 'What strengths would you bring to this database group?',
        type: 'text',
        weight: 0.25,
      },
    ],
    groupSize: 5,
    minimumGroupSize: 4,
    mixGender: true,
    mixYear: true,
    allowBuddy: true,
    status: 'active',
    createdAt: '2026-03-03T10:00:00Z',
    responseCount: 18,
    totalStudents: 40,
  },
  '2-g2': {
    id: 'form-2-g2',
    courseId: '2',
    groupId: '2-g2',
    title: 'Team Formation Survey - CS4320G2',
    description: 'Please answer the following questions to help us form balanced teams for CS4320G2.',
    criteria: [
      {
        id: 'c1',
        question: 'How confident are you with SQL and schema design?',
        type: 'multiple-choice',
        options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
        weight: 0.35,
      },
      {
        id: 'c2',
        question: 'Rate your debugging skills (1-10)',
        type: 'scale',
        weight: 0.2,
      },
      {
        id: 'c3',
        question: 'Which role do you usually take in a database project?',
        type: 'multiple-choice',
        options: ['Designer', 'Builder', 'Tester', 'Flexible'],
        weight: 0.2,
      },
      {
        id: 'c4',
        question: 'What strengths would you bring to this database group?',
        type: 'text',
        weight: 0.25,
      },
    ],
    groupSize: 5,
    minimumGroupSize: 4,
    mixGender: true,
    mixYear: true,
    allowBuddy: true,
    status: 'active',
    createdAt: '2026-03-04T10:00:00Z',
    responseCount: 28,
    totalStudents: 40,
  },
};

export const mockStudents: Student[] = [
  { id: 's1', name: 'Jereme', email: 'jereme@smu.sg', studentId: 'ID-1' },
  { id: 's2', name: 'Mary Jane', email: 'Mary.Jane.2023@business.smu.edu.sg', studentId: 'ID-2' },
  { id: 's3', name: 'John Doe', email: 'John.Doe.2023@business.smu.edu.sg', studentId: 'ID-3' },
  { id: 's4', name: 'Timmy Turner', email: 'Timmy.Turner.2023@business.smu.edu.sg', studentId: 'ID-4' },
  { id: 's5', name: 'Kim Jun Un', email: 'kim.ju.2024@business.smu.edu.sg', studentId: 'ID-5' },
  { id: 's6', name: 'Student 6', email: 'student6@smu.edu.sg', studentId: 'ID-14' },
  { id: 's7', name: 'Student 7', email: 'student7@smu.edu.sg', studentId: 'ID-15' },
  { id: 's8', name: 'Student 8', email: 'student8@smu.edu.sg', studentId: 'ID-16' },
  { id: 's9', name: 'Student 9', email: 'student9@smu.edu.sg', studentId: 'ID-17' },
  { id: 's10', name: 'Student 10', email: 'student10@smu.edu.sg', studentId: 'ID-18' },
  { id: 's11', name: 'Student 11', email: 'student11@smu.edu.sg', studentId: 'ID-19' },
  { id: 's12', name: 'Student 4', email: 'student4@smu.edu.sg', studentId: 'ID-12' },
  { id: 's13', name: 'Student 13', email: 'student13@smu.edu.sg', studentId: 'ID-21' },
  { id: 's14', name: 'Student 14', email: 'student14@smu.edu.sg', studentId: 'ID-22' },
  { id: 's15', name: 'Student 15', email: 'student15@smu.edu.sg', studentId: 'ID-23' },
  { id: 's16', name: 'Student 16', email: 'student16@smu.edu.sg', studentId: 'ID-24' },
  { id: 's17', name: 'Student 17', email: 'student17@smu.edu.sg', studentId: 'ID-25' },
  { id: 's18', name: 'Student 18', email: 'student18@smu.edu.sg', studentId: 'ID-26' },
  { id: 's19', name: 'Student 19', email: 'student19@smu.edu.sg', studentId: 'ID-27' },
  { id: 's20', name: 'Student 20', email: 'student20@smu.edu.sg', studentId: 'ID-28' },
];

export const mockStudentStrengths: Record<string, string[]> = {
  s1: ['Backend development', 'API integration'],
  s2: ['Project coordination', 'Team communication'],
  s3: ['UI design', 'User empathy'],
  s4: ['Testing', 'Debugging'],
  s5: ['Documentation', 'Presentation'],
  s6: ['Database design', 'Query optimization'],
  s7: ['Frontend implementation', 'Accessibility'],
  s8: ['System architecture', 'Backend development'],
  s9: ['Research', 'UX writing'],
  s10: ['DevOps', 'Deployment'],
  s11: ['Problem solving', 'Java'],
  s12: ['Data modeling', 'SQL'],
  s13: ['Wireframing', 'Figma prototyping'],
  s14: ['Python', 'Automation'],
  s15: ['Facilitation', 'Agile planning'],
  s16: ['SQL optimisation', 'Database modeling'],
  s17: ['Testing', 'Team coordination'],
  s18: ['Backend APIs', 'Documentation'],
  s19: ['Data cleaning', 'Presentation'],
  s20: ['Query tuning', 'Communication'],
};

export const mockTeams: Team[] = [
  {
    id: 't1',
    courseId: '1',
    groupId: '1-g1',
    name: 'Team Alpha',
    members: [
      withStatus(mockStudents[0], 'pending'),
      withStatus(mockStudents[1], 'confirmed'),
      withStatus(mockStudents[2], 'confirmed'),
      withStatus(mockStudents[3], 'pending'),
      withStatus(mockStudents[4], 'confirmed'),
    ],
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
      withStatus(mockStudents[5], 'pending'),
      withStatus(mockStudents[6], 'pending'),
      withStatus(mockStudents[7], 'confirmed'),
      withStatus(mockStudents[8], 'confirmed'),
      withStatus(mockStudents[9], 'pending'),
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
      withStatus(mockStudents[10], 'confirmed'),
      withStatus(mockStudents[11], 'confirmed'),
      withStatus(mockStudents[12], 'confirmed'),
      withStatus(mockStudents[13], 'confirmed'),
      withStatus(mockStudents[14], 'confirmed'),
    ],
    formationScore: 95,
    diversity: {
      skillLevel: 0.93,
      background: 0.87,
      workStyle: 0.95,
    },
  },
  {
    id: 't4',
    courseId: '2',
    groupId: '2-g2',
    name: 'Team Delta',
    members: [
      withStatus(mockStudents[0], 'confirmed'),
      withStatus(mockStudents[15], 'confirmed'),
      withStatus(mockStudents[16], 'confirmed'),
      withStatus(mockStudents[17], 'confirmed'),
      withStatus(mockStudents[18], 'confirmed'),
    ],
    formationScore: 90,
    diversity: {
      skillLevel: 0.88,
      background: 0.84,
      workStyle: 0.89,
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
    groupId: '1-g1',
    reason: 'I am having collaboration difficulties in my current team and would prefer to be reassigned if possible.',
    status: 'pending',
    createdAt: '2026-03-12T14:30:00Z',
  },
  {
    id: 'sr2',
    courseId: '1',
    courseName: 'Software Engineering',
    studentId: 's11',
    studentName: 'Kelly Martinez',
    currentTeamId: 't3',
    currentTeamName: 'Team Gamma',
    groupId: '1-g2',
    reason: 'My current team meeting schedule clashes with my part-time work, so I am requesting a team change.',
    status: 'approved',
    createdAt: '2026-03-11T09:15:00Z',
  },
];

export const currentStudent: Student = {
  id: 's1',
  name: 'Student 4',
  email: 'student4@smu.edu.sg',
  studentId: 'ID-12',
};

export const currentStudentTeams = mockTeams.filter((team) =>
  team.members.some((member) => member.id === currentStudent.id),
);

export const currentStudentTeam = currentStudentTeams[0];



export const mockPeerEvaluationRounds: PeerEvaluationRound[] = [];

export const mockPeerEvaluationSubmissions: PeerEvaluationSubmission[] = [];



