import { Outlet } from 'react-router-dom'
import './auth.css'

export function AuthLayout() {
  return (
    <div className="auth-container">
      <div className="auth-brand-panel">
        <div className="brand-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="brand-name">Compira</h1>
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
