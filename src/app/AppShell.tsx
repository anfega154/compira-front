import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { NotificationCenter } from '../features/notifications/NotificationCenter'
import { CompiraLogo } from './CompiraLogo'
import { useAuth } from '../features/auth/useAuth'
import {
  canConfigureOrganization,
  canManageUsers,
  canReceiveNotifications,
  canViewAssignedTasks,
  canViewReports,
  canViewTaskBoard,
  canViewTeams,
} from '../features/auth/permissions'

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: 'Administrador',
  COORDINATOR: 'Coordinador',
  COLLABORATOR: 'Colaborador',
}

const PAGE_CONTEXT: { match: (path: string) => boolean; eyebrow: string; title: string }[] = [
  { match: (p) => p === '/dashboard', eyebrow: 'Monitoreo', title: 'Panel de monitoreo' },
  { match: (p) => p === '/tasks', eyebrow: 'Gestión de tareas', title: 'Tareas del equipo' },
  { match: (p) => p === '/tasks/create', eyebrow: 'Gestión de tareas', title: 'Crear tarea' },
  { match: (p) => p === '/tasks/assigned', eyebrow: 'Mis tareas', title: 'Tareas asignadas' },
  { match: (p) => p.startsWith('/tasks/'), eyebrow: 'Gestión de tareas', title: 'Detalle de tarea' },
  { match: (p) => p === '/reports', eyebrow: 'Administración', title: 'Reportes' },
  { match: (p) => p === '/users', eyebrow: 'Administración', title: 'Usuarios' },
  { match: (p) => p === '/users/register', eyebrow: 'Administración', title: 'Registrar usuario' },
  { match: (p) => p === '/teams', eyebrow: 'Administración', title: 'Equipos' },
  { match: (p) => p === '/organization/settings', eyebrow: 'Administración', title: 'Configuración' },
]

function initials(firstName?: string, lastName?: string): string {
  const first = firstName?.trim().charAt(0) ?? ''
  const last = lastName?.trim().charAt(0) ?? ''
  return `${first}${last}`.toUpperCase() || 'C'
}

type NavItemProps = {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
  onNavigate: () => void
}

function NavItem({ to, label, icon, end, onNavigate }: NavItemProps) {
  return (
    <NavLink to={to} end={end} onClick={onNavigate}>
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}

export function AppShell() {
  const { user, endSession } = useAuth()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  function handleLogout() {
    void endSession()
  }

  const roleLabel = user?.roles
    ?.map((role) => ROLE_LABELS[role] ?? role)
    .join(' · ')

  const showAdminSection = canManageUsers(user) || canConfigureOrganization(user) || canViewReports(user) || canViewTeams(user)
  const context = PAGE_CONTEXT.find((entry) => entry.match(location.pathname))
  const closeNav = () => setNavOpen(false)

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <CompiraLogo variant="mark" size={34} tone="color" />
          <span className="sidebar-brand-name">COMPIRA</span>
        </div>

        <div className="sidebar-user">
          <span className="sidebar-avatar" aria-hidden="true">{initials(user?.firstName, user?.lastName)}</span>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-name">
              {user ? `${user.firstName} ${user.lastName}` : 'Gestión centralizada de tareas'}
            </span>
            {roleLabel ? <span className="sidebar-role">{roleLabel}</span> : null}
          </div>
        </div>

        <nav className="nav-links" aria-label="Navegación principal">
          <p className="nav-section-label">Trabajo</p>
          {canViewTaskBoard(user) && (
            <NavItem to="/dashboard" label="Panel de monitoreo" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
            } />
          )}
          {canViewTaskBoard(user) && (
            <NavItem to="/tasks" end label="Tareas del equipo" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            } />
          )}
          {canViewAssignedTasks(user) && (
            <NavItem to="/tasks/assigned" label="Mis tareas" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            } />
          )}

          {showAdminSection && <p className="nav-section-label">Administración</p>}
          {canManageUsers(user) && (
            <NavItem to="/users" end label="Usuarios" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            } />
          )}
          {canManageUsers(user) && (
            <NavItem to="/users/register" label="Registrar usuario" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
              </svg>
            } />
          )}
          {canViewReports(user) && (
            <NavItem to="/reports" label="Reportes" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3v18h18" /><rect x="7" y="10" width="3" height="7" /><rect x="12" y="6" width="3" height="11" /><rect x="17" y="13" width="3" height="4" />
              </svg>
            } />
          )}
          {canConfigureOrganization(user) && (
            <NavItem to="/organization/settings" label="Configuración" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            } />
          )}
          {canViewTeams(user) && (
            <NavItem to="/teams" label="Equipos" onNavigate={closeNav} icon={
              <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            } />
          )}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="logout-button" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesion
          </button>
        </div>
      </aside>

      {navOpen && <button type="button" className="sidebar-backdrop" aria-label="Cerrar menú" onClick={closeNav} />}

      <div className="content">
        <header className="topbar">
          <button
            type="button"
            className="topbar-menu-button"
            aria-label="Abrir menú de navegación"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="topbar-context">
            <span className="topbar-eyebrow">{context?.eyebrow ?? 'COMPIRA'}</span>
            <span className="topbar-title">{context?.title ?? 'Espacio de trabajo'}</span>
          </div>
          <div className="topbar-actions">
            {canReceiveNotifications(user) && <NotificationCenter key={user?.id} />}
          </div>
        </header>

        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
