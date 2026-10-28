import { Outlet } from 'react-router-dom'
import { CompiraLogo } from '../../app/CompiraLogo'
import './auth.css'

export function AuthLayout() {
  return (
    <div className="auth-container">
      <div className="auth-brand-panel">
        <div className="brand-logo" aria-hidden="true">
          <CompiraLogo variant="mark" size={44} tone="light" />
        </div>
        <h1 className="brand-name">COMPIRA</h1>
        <p className="brand-tagline">
          Flujos simples para pymes.
          <br />
          Centraliza, organiza y cumple.
        </p>
      </div>

      <main className="auth-content-panel">
        <Outlet />
      </main>
    </div>
  )
}
