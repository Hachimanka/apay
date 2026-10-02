import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as DM from '@radix-ui/react-dropdown-menu'
import { motion } from 'motion/react'
import { ChevronDown, Ellipsis, LogOut, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { InstallButton } from '@/components/pwa/InstallButton'
import { useAuth } from '@/store/auth'
import { can, roleLabels } from '@/lib/permissions'
import { cn } from '@/lib/cn'
import { mobileTabs, navGroups, type NavItem } from './nav'

function useVisibleGroups() {
  const role = useAuth((s) => s.session?.user.role)
  return navGroups.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(role, i.permission)) })).filter((g) => g.items.length > 0)
}

export function AppLayout() {
  const location = useLocation()
  return (
    <div className="min-h-dvh bg-bg">
      <Topbar />
      {/* Sidebar sits flush against the left edge; only the page content is width-capped */}
      <div className="flex">
        <Sidebar />
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

function Topbar() {
  const user = useAuth((s) => s.session?.user)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl print:hidden">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:h-[76px] lg:px-8">
        <Logo to="/app" className="hidden sm:inline-flex" />
        <Logo to="/app" stacked className="sm:hidden" />

        <div className="flex items-center gap-2 sm:gap-4">
          <InstallButton className="hidden md:inline-flex" />
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
                <DM.Content align="end" sideOffset={8} className="z-50 w-60 rounded-2xl border border-line bg-white p-1.5 shadow-float">
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

function Sidebar() {
  const groups = useVisibleGroups()
  return (
    <div className="hidden w-64 shrink-0 border-r border-line bg-white lg:block print:hidden">
      <aside className="sticky top-[76px] flex h-[calc(100dvh-76px)] flex-col overflow-y-auto px-4 py-5">
        <nav className="space-y-5">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-4 pb-1.5 text-[11px] font-bold tracking-wider text-muted/70 uppercase">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <SideLink key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-navy to-primary-700 p-4 text-white">
          <p className="text-sm font-bold">Connected to AZONE</p>
          <p className="mt-1 text-xs text-white/75">Released payslips and announcements appear in employees’ AZONE app.</p>
        </div>
      </aside>
    </div>
  )
}

function SideLink({ to, label, icon: Icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary text-white shadow-[0_8px_20px_-8px_rgb(21_87_224/0.6)]'
            : 'text-ink hover:translate-x-1 hover:bg-primary-50 hover:text-primary',
        )
      }
    >
      <Icon className="size-[18px]" />
      {label}
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
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-xl lg:hidden print:hidden">
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
