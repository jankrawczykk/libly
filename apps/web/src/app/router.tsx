import { createBrowserRouter, Navigate } from 'react-router-dom'
import { App } from '../App.js'
import { DashboardPage } from '../features/dashboard/dashboard-page.js'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
  },
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
