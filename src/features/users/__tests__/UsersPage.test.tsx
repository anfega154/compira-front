import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { UsersPage } from '../UsersPage'
import type { OrganizationUser } from '../usersApi'

const fetchMock = vi.fn()

function buildUser(overrides: Partial<OrganizationUser> = {}): OrganizationUser {
  return {
    id: 'user-1',
    email: 'collaborator@compira.co',
    firstName: 'Ana',
    lastName: 'García',
    phoneNumber: '+573001112233',
    status: 'ACTIVE',
    roles: ['COLLABORATOR'],
    teamId: 'team-1',
    teamName: 'Operaciones',
    createdAt: '2026-09-20T10:00:00Z',
    lastLoginAt: '2026-09-24T08:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  persistSession(module3User('ADMINISTRATOR'), module3Tokens)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

describe('UsersPage (HU-40 / HU-10)', () => {
  it('lists the organization users with their roles and team', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([buildUser()]))
    renderWithProviders(<UsersPage />)

    const row = await screen.findByRole('row', { name: /collaborator@compira\.co/i })
    expect(within(row).getByText('Colaborador')).toBeInTheDocument()
    expect(within(row).getByText('Operaciones')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/users'), expect.objectContaining({ method: 'GET' }))
  })

  it('shows an empty state when there are no users', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]))
    renderWithProviders(<UsersPage />)
    expect(await screen.findByText('No hay usuarios registrados en la organización.')).toBeInTheDocument()
  })

  it('shows an error state when the request fails', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ code: 'USER_ADMIN_403', message: 'Prohibido' }, { status: 403 }))
    renderWithProviders(<UsersPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Prohibido')
  })

  it('updates the role set of a selected user', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json([buildUser()]))
      .mockResolvedValueOnce(Response.json(buildUser({ roles: ['COORDINATOR', 'COLLABORATOR'] })))
    const { user } = renderWithProviders(<UsersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('checkbox', { name: 'Coordinador' }))
    await user.click(screen.getByRole('button', { name: 'Guardar roles' }))

    expect(await screen.findByText('Roles actualizados.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users/roles'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ email: 'collaborator@compira.co', roles: ['COLLABORATOR', 'COORDINATOR'] }) }),
    )
  })

  it('prevents saving an empty role set', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([buildUser()]))
    const { user } = renderWithProviders(<UsersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('checkbox', { name: 'Colaborador' }))
    expect(screen.getByRole('button', { name: 'Guardar roles' })).toBeDisabled()
  })

  it('resets the temporary password of a selected user', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json([buildUser()]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const { user } = renderWithProviders(<UsersPage />)

    await user.click(await screen.findByRole('button', { name: 'Editar' }))
    await user.type(screen.getByLabelText('Nueva contraseña temporal'), 'TempPass123*')
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }))

    expect(await screen.findByText(/contraseña temporal restablecida/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/users/password-reset'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'collaborator@compira.co', temporaryPassword: 'TempPass123*' }) }),
    )
  })
})
