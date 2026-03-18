import { RouterProvider, createBrowserRouter } from 'react-router'
import AppShell from './app/layouts/AppShell'
import Analytics from './pages/instructor/Analytics'
import CreateForm from './pages/instructor/CreateForm'
import Courses from './pages/instructor/Courses'
import InstructorDashboard from './pages/instructor/InstructorDashboard'
import FillForm from './pages/student/FillForm'
import MyTeam from './pages/student/MyTeam'
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
        path: 'instructor/courses/:courseId/create-form',
        element: <CreateForm />,
      },
      {
        path: 'student/form/:formId',
        element: <FillForm />,
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
