import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { persistSession } from '../../features/auth/authStorage'
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
