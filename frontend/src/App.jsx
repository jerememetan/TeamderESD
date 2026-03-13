import { RouterProvider, createBrowserRouter } from 'react-router'
import AppShell from './app/layouts/AppShell'
import HomePage from './pages/HomePage'
import TestGalleryPage from './pages/TestGalleryPage'

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
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
