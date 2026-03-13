import { RouterProvider, createBrowserRouter } from 'react-router'
import AppShell from './app/layouts/AppShell'
import HomePage from './pages/HomePage'
import TestGalleryPage from './pages/TestGalleryPage'
import InstructorDashboard from './pages/InstructorDashboard'
import StudentDashBoard from './pages/StudentDashboard'

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
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
