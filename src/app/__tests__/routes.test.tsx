import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '../../features/auth/AuthContext'
import { persistSession } from '../../features/auth/authStorage'
import type { AuthTokens, AuthUser } from '../../features/auth/types'
import { ProtectedRoute } from '../ProtectedRoute'
import { PublicRoute } from '../PublicRoute'

const mockUser: AuthUser = {
  id: '1',
  cognitoSub: 'sub',
  email: 'test@empresa.com',
  firstName: 'Andres',
  lastName: 'Ganan',
  phoneNumber: '+573001234567',
  preferredMfaChannel: 'EMAIL',
  status: 'ACTIVE',
  roles: ['COORDINATOR'],
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-20T15:30:00Z',
  lastLoginAt: '2026-08-22T08:00:00Z',
}

const mockTokens: AuthTokens = {
  accessToken: 'access',
  idToken: 'id',
  refreshToken: 'refresh',
  expiresIn: 3600,
  tokenType: 'Bearer',
}

function renderRoutes(initialEntries: string[], authenticated: boolean) {
  if (authenticated) {
    persistSession(mockUser, mockTokens)
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/auth/login" element={<div>Login Page</div>} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Page</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('redirects to /auth/login when not authenticated', () => {
    renderRoutes(['/dashboard'], false)

    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument()
  })

  it('renders child route when authenticated', () => {
    renderRoutes(['/dashboard'], true)

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
  })
})

describe('PublicRoute', () => {
  it('renders child route when not authenticated', () => {
    renderRoutes(['/auth/login'], false)

    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('redirects away from auth pages when authenticated', () => {
    renderRoutes(['/auth/login'], true)

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })
})
