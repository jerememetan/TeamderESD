import { RouterProvider, createBrowserRouter } from 'react-router'
import AppShell from './app/layouts/AppShell'
import Analytics from './pages/instructor/Analytics/Analytics'
import CompletionStatus from './pages/instructor/CompletionStatus/CompletionStatus'
import CreateForm from './pages/instructor/CreateForm/CreateForm'
import Courses from './pages/instructor/Courses/Courses'
import InstructorDashboard from './pages/instructor/Dashboard/InstructorDashboard'
import ErrorLogs from './pages/instructor/ErrorLogs/ErrorLogs'
import SwapRequests from './pages/instructor/SwapRequests/SwapRequests'
import Teams from './pages/instructor/Teams/Teams'
import FillForm from './pages/student/FillForm/FillForm'
import MyTeam from './pages/student/MyTeam/MyTeam'
import PeerEvaluationForm from './pages/student/PeerEvaluation/PeerEvaluationForm'
import StudentDashBoard from './pages/student/StudentDashboard/StudentDashboard'
import HomePage from './pages/shared/HomePage'
import TestGalleryPage from './pages/shared/TestGalleryPage'
import PeerEval from './pages/instructor/PeerEval/PeerEval'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'test',
        element: <TestGalleryPage />,
      },
      {
        path: 'instructor',
        element: <InstructorDashboard />,
      },
      {
        path: 'student/:studentId',
        element: <StudentDashBoard />,
      },
      {
        path: 'instructor/courses',
        element: <Courses />,
      },
      {
        path: 'instructor/courses/:courseId/groups/:groupId/analytics',
        element: <Analytics />,
      },
      {
        path: 'instructor/courses/:courseId/groups/:groupId/completion-status',
        element: <CompletionStatus />,
      },
      {
        path: 'instructor/courses/:courseId/groups/:groupId/create-form',
        element: <CreateForm />,
      },
      {
        path: 'instructor/courses/:courseId/teams',
        element: <Teams />,
      },
      {
        path: 'instructor/courses/:courseId/groups/:groupId/teams',
        element: <Teams />,
        
      },
      {
        path: 'instructor/courses/:courseId/groups/:groupId/peer-eval',
        element: <PeerEval />,
      },
      {
        path: 'instructor/swap-requests',
        element: <SwapRequests />,
      },
      {
        path: 'instructor/error-logs',
        element: <ErrorLogs />,
      },
      {
        path: 'student/:studentId/form',
        element: <FillForm />,
      },
      {
        path: 'student/:studentId/form/:formId',
        element: <FillForm />,
      },
      {
        path: 'student/:studentId/peer-evaluation',
        element: <PeerEvaluationForm />,
      },
      {
        path: 'student/:studentId/peer-evaluation/:roundId',
        element: <PeerEvaluationForm />,
      },
      {
        path: 'student/:studentId/team',
        element: <MyTeam />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App

