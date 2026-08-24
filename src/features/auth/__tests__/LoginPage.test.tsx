import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { LoginPage } from '../LoginPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../authApi', () => ({
  login: vi.fn(),
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

import { login } from '../authApi'

const mockLogin = vi.mocked(login)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('renders login form with email and password fields', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.getByLabelText('Correo electronico')).toBeInTheDocument()
    expect(screen.getByLabelText('Contrasena')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar sesion/i })).toBeInTheDocument()
  })

  it('has a link to password recovery', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.getByRole('link', { name: /recuperar contrasena/i })).toBeInTheDocument()
  })

  it('disables submit button when fields are empty', () => {
    renderWithProviders(<LoginPage />)

    const button = screen.getByRole('button', { name: /iniciar sesion/i })
    expect(button).toBeDisabled()
  })

  it('enables submit button when both fields have values', async () => {
    const { user } = renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText('Correo electronico'), 'test@empresa.com')
    await user.type(screen.getByLabelText('Contrasena'), 'Password123!')

    expect(screen.getByRole('button', { name: /iniciar sesion/i })).toBeEnabled()
  })

  it('toggles password visibility', async () => {
    const { user } = renderWithProviders(<LoginPage />)

    const passwordInput = screen.getByLabelText('Contrasena')
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /mostrar contrasena/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /ocultar contrasena/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('calls login API on form submit and navigates on success', async () => {
    mockLogin.mockResolvedValueOnce({
      status: 'AUTHENTICATED',
      user: { id: '1', cognitoSub: 'sub', email: 'test@empresa.com', firstName: 'A', lastName: 'B', phoneNumber: '+57300', preferredMfaChannel: 'EMAIL', status: 'ACTIVE', roles: ['COORDINATOR'], createdAt: '', updatedAt: '', lastLoginAt: '' },
      tokens: { accessToken: 'tok', idToken: 'id', refreshToken: 'ref', expiresIn: 3600, tokenType: 'Bearer' },
      challenge: null,
    })

    const { user } = renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText('Correo electronico'), 'test@empresa.com')
    await user.type(screen.getByLabelText('Contrasena'), 'Password123!')
    await user.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    expect(mockLogin).toHaveBeenCalledWith({ email: 'test@empresa.com', password: 'Password123!' })
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('navigates to /auth/verify on EMAIL_OTP challenge', async () => {
    mockLogin.mockResolvedValueOnce({
      status: 'CHALLENGE_REQUIRED',
      user: null,
      tokens: null,
      challenge: { challengeName: 'EMAIL_OTP', session: 'sess-123', availableMfaChannels: ['EMAIL'], codeDeliveryDetails: { destination: 't***@e.com', deliveryMedium: 'EMAIL', attributeName: 'email' } },
    })

    const { user } = renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText('Correo electronico'), 'test@empresa.com')
    await user.type(screen.getByLabelText('Contrasena'), 'Password123!')
    await user.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/auth/verify', expect.objectContaining({ state: expect.objectContaining({ email: 'test@empresa.com', session: 'sess-123' }) }))
  })

  it('navigates to /auth/new-password on NEW_PASSWORD_REQUIRED challenge', async () => {
    mockLogin.mockResolvedValueOnce({
      status: 'CHALLENGE_REQUIRED',
      user: null,
      tokens: null,
      challenge: { challengeName: 'NEW_PASSWORD_REQUIRED', session: 'sess-456', availableMfaChannels: [], codeDeliveryDetails: null },
    })

    const { user } = renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText('Correo electronico'), 'test@empresa.com')
    await user.type(screen.getByLabelText('Contrasena'), 'Password123!')
    await user.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/auth/new-password', expect.objectContaining({ state: expect.objectContaining({ email: 'test@empresa.com', session: 'sess-456' }) }))
  })

  it('displays error message on login failure', async () => {
    const { AuthRequestError } = await import('../authApi')
    mockLogin.mockRejectedValueOnce(new AuthRequestError({ code: 'AUTH_005', message: 'Las credenciales ingresadas no son validas', category: 'UNAUTHORIZED' }))

    const { user } = renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText('Correo electronico'), 'test@empresa.com')
    await user.type(screen.getByLabelText('Contrasena'), 'wrong')
    await user.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Las credenciales ingresadas no son validas')
  })

  it('shows loading state while submitting', async () => {
    let resolveLogin: (value: unknown) => void
    mockLogin.mockImplementationOnce(() => new Promise((resolve) => { resolveLogin = resolve }))

    const { user } = renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText('Correo electronico'), 'test@empresa.com')
    await user.type(screen.getByLabelText('Contrasena'), 'Password123!')
    await user.click(screen.getByRole('button', { name: /iniciar sesion/i }))

    expect(screen.getByRole('button', { name: /ingresando/i })).toBeDisabled()

    resolveLogin!({ status: 'AUTHENTICATED', user: { id: '1' }, tokens: { accessToken: 'x' }, challenge: null })
  })
})
