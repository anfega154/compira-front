import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { RegisterUserPage } from '../RegisterUserPage'

vi.mock('../../auth/authApi', () => ({
  registerUser: vi.fn(),
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

import { registerUser } from '../../auth/authApi'

const mockRegisterUser = vi.mocked(registerUser)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('RegisterUserPage', () => {
  it('renders all form fields', () => {
    renderWithProviders(<RegisterUserPage />)

    expect(screen.getByRole('heading', { name: /registrar usuario/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/correo electronico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/telefono/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contrasena temporal/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/rol/i)).toBeInTheDocument()
  })

  it('has a country code dropdown for phone', () => {
    renderWithProviders(<RegisterUserPage />)

    const countrySelect = screen.getByLabelText(/codigo de pais/i)
    expect(countrySelect).toBeInTheDocument()
    expect(countrySelect).toHaveValue('+57')
  })

  it('shows password criteria tooltip on password focus', async () => {
    const { user } = renderWithProviders(<RegisterUserPage />)

    await user.click(screen.getByLabelText(/contrasena temporal/i))

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText(/minimo 10 caracteres/i)).toBeInTheDocument()
  })

  it('disables submit when required fields are empty', () => {
    renderWithProviders(<RegisterUserPage />)

    expect(screen.getByRole('button', { name: /crear usuario/i })).toBeDisabled()
  })

  it('submits form and shows success message', async () => {
    mockRegisterUser.mockResolvedValueOnce({
      cognitoSub: 'sub-new',
      userConfirmed: false,
      codeDeliveryDetails: { destination: 'n***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' },
    })

    const { user } = renderWithProviders(<RegisterUserPage />)

    await user.type(screen.getByLabelText(/nombre/i), 'Maria')
    await user.type(screen.getByLabelText(/apellido/i), 'Lopez')
    await user.type(screen.getByLabelText(/correo electronico/i), 'maria@test.com')
    await user.type(screen.getByLabelText(/telefono/i), '3009876543')
    await user.type(screen.getByLabelText(/contrasena temporal/i), 'TempPass123*')
    await user.click(screen.getByRole('button', { name: /crear usuario/i }))

    expect(mockRegisterUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'maria@test.com',
        password: 'TempPass123*',
        firstName: 'Maria',
        lastName: 'Lopez',
        phoneNumber: '+573009876543',
        preferredMfaChannel: 'EMAIL',
      }),
      'admin-token',
    )

    expect(await screen.findByRole('status')).toHaveTextContent(/maria@test\.com.*creado correctamente/i)
  })

  it('displays error on duplicate email', async () => {
    const { AuthRequestError } = await import('../../auth/authApi')
    mockRegisterUser.mockRejectedValueOnce(new AuthRequestError({ code: 'AUTH_001', message: 'Ya existe una cuenta registrada con este correo electronico', category: 'CONFLICT' }))

    const { user } = renderWithProviders(<RegisterUserPage />)

    await user.type(screen.getByLabelText(/nombre/i), 'Ana')
    await user.type(screen.getByLabelText(/apellido/i), 'Garcia')
    await user.type(screen.getByLabelText(/correo electronico/i), 'dup@test.com')
    await user.type(screen.getByLabelText(/telefono/i), '3001111111')
    await user.type(screen.getByLabelText(/contrasena temporal/i), 'TempPass123*')
    await user.click(screen.getByRole('button', { name: /crear usuario/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta registrada con este correo electronico')
  })

  it('allows selecting a different role', async () => {
    const { user } = renderWithProviders(<RegisterUserPage />)

    const roleSelect = screen.getByLabelText(/rol/i)
    await user.selectOptions(roleSelect, 'ADMINISTRATOR')

    expect(roleSelect).toHaveValue('ADMINISTRATOR')
  })
})
