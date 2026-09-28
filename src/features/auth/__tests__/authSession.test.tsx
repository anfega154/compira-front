import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/render'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { ProtectedRoute } from '../../../app/ProtectedRoute'
import { getStoredAccessToken, persistSession } from '../authStorage'
import { authenticatedRequest } from '../authenticatedRequest'
import { getManagedTasks } from '../../tasks/tasksApi'
import { login, registerUser } from '../authApi'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function renderSession() {
  return renderWithProviders(<Routes>
    <Route element={<ProtectedRoute />}><Route path="/tasks" element={<h1>Tareas privadas</h1>} /></Route>
    <Route path="/auth/login" element={<h1>Iniciar sesión</h1>} />
  </Routes>, { initialEntries: ['/tasks'] })
}

describe('session expiration', () => {
  it('redirects and removes expired credentials on reload without sending requests', () => {
    persistSession(module3User(), { ...module3Tokens, expiresIn: -1 })
    localStorage.setItem('compira_access_token', 'legacy-token')
    localStorage.setItem('preference', 'keep')
    renderSession()
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(getStoredAccessToken()).toBeNull()
    expect(sessionStorage.getItem('compira_user')).toBeNull()
    expect(localStorage.getItem('compira_access_token')).toBeNull()
    expect(localStorage.getItem('preference')).toBe('keep')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('expires an idle authenticated screen at the token deadline', async () => {
    vi.useFakeTimers()
    persistSession(module3User(), { ...module3Tokens, expiresIn: 1 })
    renderSession()
    expect(screen.getByRole('heading', { name: 'Tareas privadas' })).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(getStoredAccessToken()).toBeNull()
  })

  it('does not send an already expired access token', async () => {
    persistSession(module3User(), { ...module3Tokens, expiresIn: -1 })
    await expect(authenticatedRequest('/teams')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getStoredAccessToken()).toBeNull()
  })

  it.each([
    ['shared requests', () => authenticatedRequest('/teams')],
    ['tasks', () => getManagedTasks()],
    ['user administration', () => registerUser({ email: 'new@compira.co', password: 'Password123!', firstName: 'Ana', lastName: 'García', phoneNumber: '+573001112233', preferredMfaChannel: 'EMAIL' })],
  ] as const)('clears the session and redirects on empty-body 401 from %s', async (_name, request) => {
    persistSession(module3User(), module3Tokens)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    renderSession()
    await act(async () => { await expect(request()).rejects.toMatchObject({ status: 401 }) })
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument()
    expect(getStoredAccessToken()).toBeNull()
    expect(sessionStorage.getItem('compira_refresh_token')).toBeNull()
  })

  it('preserves the session when the network fails', async () => {
    persistSession(module3User(), module3Tokens)
    fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'))
    await expect(authenticatedRequest('/teams')).rejects.toThrow('Network unavailable')
    expect(getStoredAccessToken()).toBe(module3Tokens.accessToken)
  })

  it.each([403, 500])('keeps a valid session on HTTP %s', async status => {
    persistSession(module3User(), module3Tokens)
    fetchMock.mockResolvedValueOnce(new Response(null, { status }))
    await expect(authenticatedRequest('/teams')).rejects.toMatchObject({ status })
    expect(getStoredAccessToken()).toBe(module3Tokens.accessToken)
  })

  it('does not clear a new session when an earlier request returns 401', async () => {
    persistSession(module3User(), module3Tokens)
    let rejectOldRequest: (response: Response) => void = () => undefined
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { rejectOldRequest = resolve }))
    const request = authenticatedRequest('/teams')
    persistSession(module3User(), { ...module3Tokens, accessToken: 'new-token' })
    rejectOldRequest(new Response(null, { status: 401 }))
    await expect(request).rejects.toMatchObject({ status: 401 })
    expect(getStoredAccessToken()).toBe('new-token')
  })

  it('does not invalidate an existing session for a public login failure', async () => {
    persistSession(module3User(), module3Tokens)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'AUTH_005', message: 'Correo o contraseña incorrectos.' }), { status: 401 }))
    await expect(login({ email: 'user@gmail.com', password: 'wrong' })).rejects.toThrow('Correo o contraseña incorrectos.')
    expect(getStoredAccessToken()).toBe(module3Tokens.accessToken)
  })
})
