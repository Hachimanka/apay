import { lazy, Suspense, type ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/Button'
import { useAuth } from '@/store/auth'
import { can, type Permission } from '@/lib/permissions'
import { AppLayout } from '@/layouts/AppLayout'
import { UpdateToast } from '@/components/pwa/UpdateToast'

// Route-level code splitting: the landing page and each module load on demand
const LandingPage = lazy(() => import('@/features/landing/LandingPage').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })))
const AttendancePage = lazy(() => import('@/pages/AttendancePage').then((m) => ({ default: m.AttendancePage })))
const OvertimePage = lazy(() => import('@/pages/OvertimePage').then((m) => ({ default: m.OvertimePage })))
const LeaveImpactPage = lazy(() => import('@/pages/LeaveImpactPage').then((m) => ({ default: m.LeaveImpactPage })))
const PeriodsPage = lazy(() => import('@/pages/PeriodsPage').then((m) => ({ default: m.PeriodsPage })))
const PeriodDetailPage = lazy(() => import('@/pages/PeriodDetailPage').then((m) => ({ default: m.PeriodDetailPage })))
const PayslipsPage = lazy(() => import('@/pages/PayslipsPage').then((m) => ({ default: m.PayslipsPage })))
const AdjustmentsPage = lazy(() => import('@/pages/AdjustmentsPage').then((m) => ({ default: m.AdjustmentsPage })))
const GovernmentPage = lazy(() => import('@/pages/GovernmentPage').then((m) => ({ default: m.GovernmentPage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const AnnouncementsPage = lazy(() => import('@/pages/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

function RequireAuth() {
  const session = useAuth((s) => s.session)
  const location = useLocation()
  return session ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const role = useAuth((s) => s.session?.user.role)
  return can(role, permission) ? children : <NoAccess />
}

/** Installed app opens at /app — skip the marketing page. */
function Home() {
  const session = useAuth((s) => s.session)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  return standalone ? <Navigate to={session ? '/app' : '/login'} replace /> : <LandingPage />
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="overtime" element={<OvertimePage />} />
              <Route path="leave-impact" element={<LeaveImpactPage />} />
              <Route path="periods" element={<PeriodsPage />} />
              <Route path="periods/:id" element={<PeriodDetailPage />} />
              <Route path="payslips" element={<PayslipsPage />} />
              <Route path="adjustments" element={<AdjustmentsPage />} />
              <Route path="government" element={<GovernmentPage />} />
              <Route
                path="reports"
                element={
                  <Guard permission="reports.view">
                    <ReportsPage />
                  </Guard>
                }
              />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route
                path="settings"
                element={
                  <Guard permission="settings.manage">
                    <SettingsPage />
                  </Guard>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <UpdateToast />
    </>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-3 border-primary-100 border-t-primary" aria-label="Loading" />
    </div>
  )
}

function NoAccess() {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-extrabold text-primary-100">403</p>
      <h1 className="text-xl font-bold">You don’t have access to this module</h1>
      <p className="text-sm text-muted">Ask a Payroll Admin if you need this permission.</p>
      <Link to="/app" className={buttonVariants({ size: 'sm' })}>
        Back to dashboard
      </Link>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-7xl font-extrabold text-primary-100">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className={buttonVariants()}>
        Go home
      </Link>
    </div>
  )
}
