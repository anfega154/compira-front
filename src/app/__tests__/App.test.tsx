import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { getStoredUser, persistSession } from '../../features/auth/authStorage'
import type { UserRole } from '../../features/auth/types'
import { module3Stream, module3Tokens, module3User } from '../../test/module3TestData'
import { renderWithProviders } from '../../test/render'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockImplementation((url: string, options?: RequestInit) => {
    if (url.endsWith('/notifications/stream')) return Promise.resolve(module3Stream(options?.signal).response)
    if (url.endsWith('/tasks') || url.endsWith('/tasks/assigned')) return Promise.resolve(new Response('[]'))
    throw new Error(`Unexpected request: ${url}`)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('Application entry routes', () => {
  it.each<{ roles: UserRole[]; heading: string }>([
    { roles: ['ADMINISTRATOR'], heading: 'Tareas del equipo' },
    { roles: ['COORDINATOR'], heading: 'Tareas del equipo' },
    { roles: ['COLLABORATOR'], heading: 'Tareas asignadas' },
    { roles: ['COLLABORATOR', 'COORDINATOR'], heading: 'Tareas del equipo' },
  ])('opens the appropriate task page for $roles without company navigation or requests', async ({ roles, heading }) => {
    persistSession({ ...module3User(), roles }, module3Tokens)
    renderWithProviders(<App />, { initialEntries: ['/'] })

    expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled())
    expect(screen.queryByRole('link', { name: 'Empresas' })).not.toBeInTheDocument()
    if (roles.includes('ADMINISTRATOR') || roles.includes('COORDINATOR')) {
      expect(screen.getByRole('link', { name: 'Equipos' })).toBeVisible()
    } else {
      expect(screen.queryByRole('link', { name: 'Equipos' })).not.toBeInTheDocument()
    }
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/companies'))).toBe(false)
  })

  it('redirects an obsolete company URL to tasks', async () => {
    persistSession(module3User(), module3Tokens)
    renderWithProviders(<App />, { initialEntries: ['/companies'] })

    expect(await screen.findByRole('heading', { name: 'Tareas asignadas' })).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled())
  })

  it('keeps authentication required for the home page', async () => {
    renderWithProviders(<App />, { initialEntries: ['/'] })

    expect(await screen.findByLabelText('Correo electronico')).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('User management permissions', () => {
  it.each<UserRole>(['COORDINATOR', 'COLLABORATOR'])('hides user registration for %s', async (role) => {
    persistSession({ ...module3User(), roles: [role] }, module3Tokens)
    renderWithProviders(<App />, { initialEntries: ['/'] })

    await screen.findByRole('button', { name: 'Recargar' })
    expect(screen.queryByRole('link', { name: 'Registrar usuario' })).not.toBeInTheDocument()
  })

  it.each([
    { role: 'COORDINATOR', path: '/users/register' },
    { role: 'COLLABORATOR', path: '/users/register' },
  ] satisfies { role: UserRole; path: string }[])('blocks $role opening $path directly', async ({ role, path }) => {
    persistSession({ ...module3User(), roles: [role] }, module3Tokens)
    renderWithProviders(<App />, { initialEntries: [path] })

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos para acceder a esta página.')
    expect(screen.queryByRole('button', { name: /Crear usuario/ })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => /\/auth\/(register|users)/.test(String(url)))).toBe(false)
  })

  it.each([
    { path: '/users/register', action: 'Crear usuario' },
  ])('allows administrators to open $path', async ({ path, action }) => {
    persistSession({ ...module3User(), roles: ['ADMINISTRATOR'] }, module3Tokens)
    renderWithProviders(<App />, { initialEntries: [path] })

    expect(await screen.findByRole('button', { name: action })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Registrar usuario' })).toBeVisible()
  })
})

describe('First login', () => {
  it('completes password change and OTP and keeps the active session on the task screen', async () => {
    const authenticatedUser = module3User()
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url.endsWith('/auth/login')) return Promise.resolve(Response.json({
        status: 'CHALLENGE_REQUIRED',
        challenge: { challengeName: 'NEW_PASSWORD_REQUIRED', session: 'password-session' },
      }))
      if (url.endsWith('/auth/login/challenge')) {
        const request = JSON.parse(String(options?.body))
        if (request.challengeName === 'NEW_PASSWORD_REQUIRED') return Promise.resolve(Response.json({
          status: 'CHALLENGE_REQUIRED',
          challenge: { challengeName: 'EMAIL_OTP', session: 'otp-session', codeDeliveryDetails: { destination: 'u***@compira.co' } },
        }))
        expect(request).toMatchObject({ challengeName: 'EMAIL_OTP', session: 'otp-session', code: '123456' })
        return Promise.resolve(Response.json({ status: 'AUTHENTICATED', user: authenticatedUser, tokens: module3Tokens }))
      }
      if (url.endsWith('/notifications/stream')) return Promise.resolve(module3Stream(options?.signal).response)
      if (url.endsWith('/tasks/assigned')) return Promise.resolve(Response.json([]))
      throw new Error(`Unexpected request: ${url}`)
    })
    const user = userEvent.setup()
    renderWithProviders(<App />, { initialEntries: ['/auth/login'] })
    await user.type(screen.getByLabelText('Correo electronico'), authenticatedUser.email)
    await user.type(screen.getByLabelText('Contrasena', { exact: true }), 'TemporaryPass123!')
    await user.click(screen.getByRole('button', { name: 'Iniciar sesion' }))
    await user.type(await screen.findByLabelText('Nueva contrasena'), 'NewPassword123!')
    await user.type(screen.getByLabelText('Confirmar contrasena'), 'NewPassword123!')
    await user.click(screen.getByRole('button', { name: 'Establecer contrasena' }))
    await screen.findByRole('heading', { name: 'Verifica tu identidad' })
    expect(getStoredUser()).toBeNull()
    for (let index = 0; index < 6; index++) await user.type(screen.getByLabelText(`Digito ${index + 1}`), String(index + 1))
    await user.click(screen.getByRole('button', { name: 'Verificar codigo' }))

    expect(await screen.findByRole('heading', { name: 'Tareas asignadas' })).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recargar' })).toBeEnabled())
    expect(getStoredUser()?.status).toBe('ACTIVE')
    expect(screen.queryByRole('heading', { name: 'Iniciar sesion' })).not.toBeInTheDocument()
  })
})
