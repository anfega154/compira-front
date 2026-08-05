import { NavLink, Outlet } from 'react-router-dom'

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">COMPIRA</p>
          <h1>Portal base</h1>
          <p className="sidebar-copy">
            Frontend inicial en React + Vite listo para consumir el backend WebFlux.
          </p>
        </div>

        <nav className="nav-links">
          <NavLink to="/">Empresas</NavLink>
        </nav>

        <div className="sidebar-card">
          <h2>Backend esperado</h2>
          <code>GET /api/v1/companies</code>
          <code>POST /api/v1/companies</code>
          <code>GET /api/v1/companies/{"{id}"}</code>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
