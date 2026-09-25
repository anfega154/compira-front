import { NavLink, Outlet } from 'react-router-dom'
import { CompiraLogo } from './CompiraLogo'
import { useAuth } from '../features/auth/useAuth'

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: 'Administrador',
  COORDINATOR: 'Coordinador',
  COLLABORATOR: 'Colaborador',
}

export function AppShell() {
  const { user, endSession } = useAuth()

  function handleLogout() {
    void endSession()
  }

  const roleLabel = user?.roles
    ?.map((role) => ROLE_LABELS[role] ?? role)
    .join(' · ')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <CompiraLogo variant="mark" size={36} tone="color" />
            <span className="sidebar-brand-name">COMPIRA</span>
          </div>
          <p className="sidebar-copy">
            {user ? `${user.firstName} ${user.lastName}` : 'Gestion centralizada de tareas'}
          </p>
          {roleLabel ? <span className="sidebar-role">{roleLabel}</span> : null}
        </div>

        <nav className="nav-links">
          <NavLink to="/">Empresas</NavLink>
          <NavLink to="/users/register">Registrar usuario</NavLink>
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

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
