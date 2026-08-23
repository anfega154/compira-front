import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { DeleteUserPage } from '../DeleteUserPage'

vi.mock('../../auth/authApi', () => ({
  deleteUser: vi.fn(),
  AuthRequestError: class AuthRequestError extends Error {
    code: string
    category: string
    constructor(apiError: { code: string; message: string; category: string }) {
      super(apiError.message)
      this.code = apiError.code
      this.category = apiError.category
    }
  },
}))

vi.mock('../../auth/authStorage', () => ({
  getStoredAccessToken: vi.fn(() => 'admin-token'),
  getStoredUser: vi.fn(() => null),
  persistSession: vi.fn(),
  clearSession: vi.fn(),
}))

import { deleteUser } from '../../auth/authApi'

const mockDeleteUser = vi.mocked(deleteUser)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('DeleteUserPage', () => {
  it('renders form with email input', () => {
    renderWithProviders(<DeleteUserPage />)

    expect(screen.getByRole('heading', { name: /eliminar usuario/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electronico del usuario/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /eliminar usuario/i })).toBeInTheDocument()
  })

  it('disables submit when email is empty', () => {
    renderWithProviders(<DeleteUserPage />)

    expect(screen.getByRole('button', { name: /eliminar usuario/i })).toBeDisabled()
  })

  it('shows confirmation dialog before deleting', async () => {
    const { user } = renderWithProviders(<DeleteUserPage />)

    await user.type(screen.getByLabelText(/correo electronico del usuario/i), 'target@test.com')
    await user.click(screen.getByRole('button', { name: /eliminar usuario/i }))

    expect(screen.getByText(/estas seguro de eliminar/i)).toBeInTheDocument()
    expect(screen.getByText('target@test.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirmar eliminacion/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()
  })

  it('cancels deletion and hides confirmation', async () => {
    const { user } = renderWithProviders(<DeleteUserPage />)

    await user.type(screen.getByLabelText(/correo electronico del usuario/i), 'target@test.com')
    await user.click(screen.getByRole('button', { name: /eliminar usuario/i }))
    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.queryByText(/estas seguro de eliminar/i)).not.toBeInTheDocument()
  })

  it('deletes user and shows success message', async () => {
    mockDeleteUser.mockResolvedValueOnce(undefined)

    const { user } = renderWithProviders(<DeleteUserPage />)

    await user.type(screen.getByLabelText(/correo electronico del usuario/i), 'target@test.com')
    await user.click(screen.getByRole('button', { name: /eliminar usuario/i }))
    await user.click(screen.getByRole('button', { name: /confirmar eliminacion/i }))

    expect(mockDeleteUser).toHaveBeenCalledWith({ email: 'target@test.com' }, 'admin-token')
    expect(await screen.findByRole('status')).toHaveTextContent(/target@test\.com.*eliminado correctamente/i)
  })

  it('displays error when user not found', async () => {
    const { AuthRequestError } = await import('../../auth/authApi')
    mockDeleteUser.mockRejectedValueOnce(new AuthRequestError({ code: 'AUTH_007', message: 'No se encontro una cuenta asociada al usuario enviado', category: 'NOT_FOUND' }))

    const { user } = renderWithProviders(<DeleteUserPage />)

    await user.type(screen.getByLabelText(/correo electronico del usuario/i), 'nobody@test.com')
    await user.click(screen.getByRole('button', { name: /eliminar usuario/i }))
    await user.click(screen.getByRole('button', { name: /confirmar eliminacion/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontro una cuenta asociada al usuario enviado')
  })
})
