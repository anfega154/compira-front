import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export function AppShell() {
  const { user, endSession } = useAuth()

  function handleLogout() {
    void endSession()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">COMPIRA</p>
          <h1>Portal base</h1>
          <p className="sidebar-copy">
            {user ? `${user.firstName} ${user.lastName}` : 'Frontend inicial en React + Vite'}
          </p>
        </div>

        <nav className="nav-links">
          <NavLink to="/">Empresas</NavLink>
          <NavLink to="/users/register">Registrar usuario</NavLink>
          <NavLink to="/users/delete">Eliminar usuario</NavLink>
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
