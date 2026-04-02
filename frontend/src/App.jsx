import { RouterProvider, createBrowserRouter } from 'react-router'
import AppShell from './app/layouts/AppShell'
import Analytics from './pages/instructor/Analytics/Analytics'
import CreateForm from './pages/instructor/CreateForm/CreateForm'
import Courses from './pages/instructor/Courses/Courses'
import InstructorDashboard from './pages/instructor/Dashboard/InstructorDashboard'
import ErrorLogs from './pages/instructor/ErrorLogs/ErrorLogs'
import SwapRequests from './pages/instructor/SwapRequests/SwapRequests'
import Teams from './pages/instructor/Teams/Teams'
import FillForm from './pages/student/FillForm'
import MyTeam from './pages/student/MyTeam'
import PeerEvaluationForm from './pages/student/PeerEvaluationForm'
import StudentDashBoard from './pages/student/StudentDashboard'
import HomePage from './pages/shared/HomePage'
import TestGalleryPage from './pages/shared/TestGalleryPage'

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
        path: 'student',
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
        path: 'instructor/swap-requests',
        element: <SwapRequests />,
      },
      {
        path: 'instructor/error-logs',
        element: <ErrorLogs />,
      },
      {
        path: 'student/form/:formId',
        element: <FillForm />,
      },
      {
        path: 'student/peer-evaluation/:roundId',
        element: <PeerEvaluationForm />,
      },
      {
        path: 'student/team',
        element: <MyTeam />,
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App

