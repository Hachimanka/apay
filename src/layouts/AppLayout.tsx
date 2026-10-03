import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as DM from '@radix-ui/react-dropdown-menu'
import { motion } from 'motion/react'
import { ChevronDown, ChevronLeft, Ellipsis, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Breadcrumbs, type Crumb } from '@/components/ui/Misc'
import { InstallButton } from '@/components/pwa/InstallButton'
import { useAuth } from '@/store/auth'
import { useTheme } from '@/store/theme'
import { useBreadcrumb } from '@/store/breadcrumb'
import { can, roleLabels } from '@/lib/permissions'
import { cn } from '@/lib/cn'
import { mobileTabs, navGroups, type NavItem } from './nav'

function useVisibleGroups() {
  const role = useAuth((s) => s.session?.user.role)
  return navGroups.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(role, i.permission)) })).filter((g) => g.items.length > 0)
}

export function AppLayout() {
  const location = useLocation()
  useApplyTheme()
  return (
    // Sidebar runs the full height (logo on top); the top bar only spans the content column beside it. Same shell as AZONE.
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-[1400px]"
          >
            <Suspense
              fallback={
                <div className="flex min-h-[50dvh] items-center justify-center">
                  <span className="size-8 animate-spin rounded-full border-3 border-primary-100 border-t-primary" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

const allNavItems = navGroups.flatMap((g) => g.items)

/** Dashboard › section (from the nav) › record name (supplied by detail pages via useDetailCrumb). Desktop top bar only, like AZONE. */
function PageBreadcrumbs() {
  const { pathname } = useLocation()
  const detail = useBreadcrumb((s) => s.detail)
  const path = pathname.replace(/\/+$/, '')
  const section = allNavItems.find((i) => !i.end && (path === i.to || path.startsWith(`${i.to}/`)))

  const items: Crumb[] = [{ label: 'Dashboard', to: '/app' }]
  if (section && path === section.to) items.push({ label: section.label })
  else if (section) items.push({ label: section.label, to: section.to }, { label: detail ?? '…' })
  return <Breadcrumbs items={items} className="hidden lg:block" />
}

function Topbar() {
  const user = useAuth((s) => s.session?.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-xl print:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:h-[76px] lg:px-8">
        {/* The logo lives in the sidebar on desktop; phones/tablets have no sidebar, so it stays here. */}
        <Logo to="/app" className="lg:hidden" />
        <PageBreadcrumbs />

        <div className="flex items-center gap-1 sm:gap-3">
          <InstallButton className="hidden md:inline-flex" />
          <ThemeToggle />
          {user && (
            <DM.Root>
              <DM.Trigger className="flex items-center gap-3 rounded-full p-1 transition hover:bg-primary-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-100 sm:rounded-2xl sm:pr-3">
                <Avatar name={user.name} className="size-9 ring-2" />
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold text-navy">{user.name}</span>
                  <span className="block text-xs text-muted">{roleLabels[user.role]}</span>
                </span>
                <ChevronDown className="hidden size-4 text-muted sm:block" />
              </DM.Trigger>
              <DM.Portal>
                <DM.Content align="end" sideOffset={8} className="z-50 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-float">
                  <DM.Label className="px-3 py-2">
                    <span className="block text-sm font-semibold text-navy">{user.name}</span>
                    <span className="block text-xs text-muted">{user.email}</span>
                    <Badge size="sm" className="mt-2">
                      <ShieldCheck className="size-3" /> {roleLabels[user.role]}
                    </Badge>
                  </DM.Label>
                  <DM.Separator className="my-1 h-px bg-line" />
                  <DM.Item
                    onSelect={() => {
                      logout()
                      navigate('/login')
                    }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-danger outline-none data-highlighted:bg-danger-50"
                  >
                    <LogOut className="size-4" /> Sign out
                  </DM.Item>
                </DM.Content>
              </DM.Portal>
            </DM.Root>
          )}
        </div>
      </div>
    </header>
  )
}

const COLLAPSED_KEY = 'apay-sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function Sidebar() {
  const groups = useVisibleGroups()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // Storage unavailable (private mode); the toggle still works for this visit.
      }
      return !c
    })

  return (
    <div
      className={cn(
        'relative z-50 hidden shrink-0 border-r border-line bg-surface transition-[width] duration-300 ease-out lg:block print:hidden',
        collapsed ? 'w-[84px]' : 'w-64',
      )}
    >
      <aside className="sticky top-0 flex h-dvh flex-col">
        {/* Same height as the top bar so the logo row lines up with it */}
        {/* Expanded: logo left edge lines up with the nav icons (nav px-4 + link px-4 = 32px) */}
        <div className={cn('flex h-[76px] shrink-0 items-center', collapsed ? 'justify-center' : 'pl-8')}>
          {collapsed ? (
            <Link to="/app" aria-label="APay home" className="transition hover:scale-105">
              <LogoMark animate />
            </Link>
          ) : (
            <Logo to="/app" />
          )}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-[24px] -right-3.5 z-10 flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700 text-white shadow-[0_6px_16px_-6px_rgb(21_87_224/0.7)] ring-4 ring-bg transition hover:scale-110 focus:outline-none focus-visible:ring-primary-200"
        >
          <ChevronLeft className={cn('size-4 transition-transform duration-300', collapsed && 'rotate-180')} strokeWidth={2.5} />
        </button>

        {/* Scrolling lives on this inner wrapper so the toggle above can overhang the border without being clipped */}
        <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-4 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]">
          <nav className={collapsed ? 'space-y-3' : 'space-y-5'}>
            {groups.map((g, i) => (
              <div key={g.label}>
                {collapsed ? (
                  i > 0 && <div className="mx-auto mb-3 h-px w-8 bg-line" />
                ) : (
                  <p className="truncate px-4 pb-1.5 text-[11px] font-bold tracking-wider text-muted/70 uppercase">{g.label}</p>
                )}
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <SideLink key={item.to} {...item} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  )
}

function SideLink({ to, label, icon: Icon, end, collapsed }: NavItem & { collapsed?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-all duration-200',
          collapsed ? 'justify-center px-0' : 'px-4',
          isActive
            ? 'bg-primary text-white shadow-[0_8px_20px_-8px_rgb(21_87_224/0.6)]'
            : cn('text-ink hover:bg-primary-50 hover:text-primary', !collapsed && 'hover:translate-x-1'),
        )
      }
    >
      <Icon className="size-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const groups = useVisibleGroups()
  const inMore = !mobileTabs.some((t) => (t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)))

  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl lg:hidden print:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          {mobileTabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition', isActive ? 'text-primary' : 'text-muted')
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn('flex flex-col items-center justify-center gap-1 text-[11px] font-semibold', inMore ? 'text-primary' : 'text-muted')}
          >
            <Ellipsis className="size-5" />
            More
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="All modules">
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">{g.label}</p>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className="card card-hover flex flex-col items-center gap-2 p-3 text-center text-[11px] font-semibold text-navy"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary-50 text-primary">
                      <Icon className="size-4" />
                    </span>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <InstallButton variant="soft" size="md" className="mt-5 w-full" label="Install APAY on this device" />
      </Dialog>
    </>
  )
}

const THEME_COLOR = { light: '#0F1B3D', dark: '#0a1124' }

/** Dark mode only covers the signed-in app: the class is removed again when leaving it (landing/login stay light). */
function useApplyTheme() {
  const theme = useTheme((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
    return () => {
      root.classList.remove('dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR.light)
    }
  }, [theme])
}

function ThemeToggle() {
  const theme = useTheme((s) => s.theme)
  const toggle = useTheme((s) => s.toggle)
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="relative rounded-full p-2.5 text-ink transition hover:bg-primary-50 hover:text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-100"
    >
      <motion.span key={theme} initial={{ rotate: -90, scale: 0.6, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} className="block">
        {dark ? <Sun className="size-5 text-amber-400" /> : <Moon className="size-5" />}
      </motion.span>
    </button>
  )
}
