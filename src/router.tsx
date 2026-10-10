import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { RequireAuth } from './lib/RequireAuth'

const Auth = lazy(() => import('./pages/Auth'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const CreateStable = lazy(() => import('./pages/CreateStable'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const HorseList = lazy(() => import('./pages/HorseList'))
const HorseDetail = lazy(() => import('./pages/HorseDetail'))
const HorseForm = lazy(() => import('./pages/HorseForm'))
const OwnerList = lazy(() => import('./pages/OwnerList'))
const OwnerDetail = lazy(() => import('./pages/OwnerDetail'))
const OwnerForm = lazy(() => import('./pages/OwnerForm'))
const StallView = lazy(() => import('./pages/StallView'))
const ContractList = lazy(() => import('./pages/ContractList'))
const ContractForm = lazy(() => import('./pages/ContractForm'))
const PaymentList = lazy(() => import('./pages/PaymentList'))
const PriceList = lazy(() => import('./pages/PriceList'))
const Inventory = lazy(() => import('./pages/Inventory'))
const CalendarView = lazy(() => import('./pages/CalendarView'))
const TaskList = lazy(() => import('./pages/TaskList'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const MyHorse = lazy(() => import('./pages/MyHorse'))
const MyContract = lazy(() => import('./pages/MyContract'))
const MyProfile = lazy(() => import('./pages/MyProfile'))
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'))
const NotFound = lazy(() => import('./pages/NotFound'))

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: (
      <Suspense fallback={null}>
        <Auth />
      </Suspense>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <Suspense fallback={null}>
        <ResetPassword />
      </Suspense>
    ),
  },
  {
    path: '/invite/:token',
    element: (
      <Suspense fallback={null}>
        <AcceptInvite />
      </Suspense>
    ),
  },
  {
    path: '/onboarding',
    element: (
      <RequireAuth requireStable={false}>
        <Suspense fallback={null}>
          <CreateStable />
        </Suspense>
      </RequireAuth>
    ),
  },
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
      { path: 'inventory', element: <Inventory /> },
      { path: 'calendar', element: <CalendarView /> },
      { path: 'tasks', element: <TaskList /> },
      { path: 'reports', element: <Reports /> },
      { path: 'settings', element: <Settings /> },
      { path: 'my-horse', element: <MyHorse /> },
      { path: 'my-contract', element: <MyContract /> },
      { path: 'my-profile', element: <MyProfile /> },
      { path: 'owner-dashboard', element: <OwnerDashboard /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
