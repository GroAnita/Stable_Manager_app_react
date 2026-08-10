import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { RequireAuth } from './lib/RequireAuth'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import HorseList from './pages/HorseList'
import HorseDetail from './pages/HorseDetail'
import HorseForm from './pages/HorseForm'
import OwnerList from './pages/OwnerList'
import OwnerDetail from './pages/OwnerDetail'
import OwnerForm from './pages/OwnerForm'
import StallView from './pages/StallView'
import ContractList from './pages/ContractList'
import ContractForm from './pages/ContractForm'
import PaymentList from './pages/PaymentList'
import PriceList from './pages/PriceList'
import CalendarView from './pages/CalendarView'
import TaskList from './pages/TaskList'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

export const router = createBrowserRouter([
  { path: '/auth', element: <Auth /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'horses', element: <HorseList /> },
      { path: 'horses/new', element: <HorseForm /> },
      { path: 'horses/:id/edit', element: <HorseForm /> },
      { path: 'horses/:id', element: <HorseDetail /> },
      { path: 'owners', element: <OwnerList /> },
      { path: 'owners/new', element: <OwnerForm /> },
      { path: 'owners/:id/edit', element: <OwnerForm /> },
      { path: 'owners/:id', element: <OwnerDetail /> },
      { path: 'stalls', element: <StallView /> },
      { path: 'contracts', element: <ContractList /> },
      { path: 'contracts/new', element: <ContractForm /> },
      { path: 'contracts/:id/edit', element: <ContractForm /> },
      { path: 'payments', element: <PaymentList /> },
      { path: 'price-list', element: <PriceList /> },
      { path: 'calendar', element: <CalendarView /> },
      { path: 'tasks', element: <TaskList /> },
      { path: 'reports', element: <Reports /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
