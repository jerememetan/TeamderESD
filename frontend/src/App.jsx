import { RouterProvider, createBrowserRouter } from 'react-router'
import HomePage from './pages/HomePage'
import TestGalleryPage from './pages/TestGalleryPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/test',
    element: <TestGalleryPage />,
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
