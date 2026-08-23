import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../AuthContext'
import { NewPasswordPage } from '../NewPasswordPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../authApi', () => ({
  respondChallenge: vi.fn(),
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

import { respondChallenge } from '../authApi'

const mockRespondChallenge = vi.mocked(respondChallenge)

const validState = {
  email: 'user@test.com',
  session: 'session-token-123',
  challenge: { challengeName: 'NEW_PASSWORD_REQUIRED', session: 'session-token-123', availableMfaChannels: [], codeDeliveryDetails: null },
}

function renderPage(state: unknown = validState) {
  const user = userEvent.setup()
  const result = render(
    <MemoryRouter initialEntries={[{ pathname: '/auth/new-password', state }]}>
      <AuthProvider>
        <NewPasswordPage />
      </AuthProvider>
    </MemoryRouter>,
  )
  return { user, ...result }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('NewPasswordPage', () => {
  it('renders password change form', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: /crea tu nueva contrasena/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/nueva contrasena/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirmar contrasena/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /establecer contrasena/i })).toBeInTheDocument()
  })

  it('redirects to login when no state is provided', () => {
    render(
      <MemoryRouter initialEntries={['/auth/new-password']}>
        <AuthProvider>
          <NewPasswordPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: /crea tu nueva contrasena/i })).not.toBeInTheDocument()
  })

  it('disables submit when passwords do not match', async () => {
    const { user } = renderPage()

    await user.type(screen.getByLabelText(/nueva contrasena/i), 'ValidPass12!')
    await user.type(screen.getByLabelText(/confirmar contrasena/i), 'DifferentPass!')

    expect(screen.getByRole('button', { name: /establecer contrasena/i })).toBeDisabled()
    expect(screen.getByText(/las contrasenas no coinciden/i)).toBeInTheDocument()
  })

  it('disables submit when password is too short', async () => {
    const { user } = renderPage()

    await user.type(screen.getByLabelText(/nueva contrasena/i), 'Short1!')
    await user.type(screen.getByLabelText(/confirmar contrasena/i), 'Short1!')

    expect(screen.getByRole('button', { name: /establecer contrasena/i })).toBeDisabled()
  })

  it('enables submit when passwords match and meet length requirement', async () => {
    const { user } = renderPage()

    await user.type(screen.getByLabelText(/nueva contrasena/i), 'ValidPass12!')
    await user.type(screen.getByLabelText(/confirmar contrasena/i), 'ValidPass12!')

    expect(screen.getByRole('button', { name: /establecer contrasena/i })).toBeEnabled()
  })

  it('shows password criteria tooltip on focus', async () => {
    const { user } = renderPage()

    await user.click(screen.getByLabelText(/nueva contrasena/i))

    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    expect(screen.getByText(/minimo 10 caracteres/i)).toBeInTheDocument()
    expect(screen.getByText(/al menos una letra mayuscula/i)).toBeInTheDocument()
  })

  it('calls respondChallenge and navigates to / on AUTHENTICATED', async () => {
    mockRespondChallenge.mockResolvedValueOnce({
      status: 'AUTHENTICATED',
      user: { id: '1', cognitoSub: 's', email: 'user@test.com', firstName: 'A', lastName: 'B', phoneNumber: '+57', preferredMfaChannel: 'EMAIL', status: 'ACTIVE', roles: ['COORDINATOR'], createdAt: '', updatedAt: '', lastLoginAt: '' },
      tokens: { accessToken: 'tok', idToken: 'id', refreshToken: 'ref', expiresIn: 3600, tokenType: 'Bearer' },
      challenge: null,
    })

    const { user } = renderPage()

    await user.type(screen.getByLabelText(/nueva contrasena/i), 'NewSecure12!')
    await user.type(screen.getByLabelText(/confirmar contrasena/i), 'NewSecure12!')
    await user.click(screen.getByRole('button', { name: /establecer contrasena/i }))

    expect(mockRespondChallenge).toHaveBeenCalledWith({
      email: 'user@test.com',
      session: 'session-token-123',
      challengeName: 'NEW_PASSWORD_REQUIRED',
      newPassword: 'NewSecure12!',
    })
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('navigates to /auth/verify when EMAIL_OTP challenge follows', async () => {
    mockRespondChallenge.mockResolvedValueOnce({
      status: 'CHALLENGE_REQUIRED',
      user: null,
      tokens: null,
      challenge: { challengeName: 'EMAIL_OTP', session: 'new-session', availableMfaChannels: ['EMAIL'], codeDeliveryDetails: { destination: 'u***@t.com', deliveryMedium: 'EMAIL', attributeName: 'email' } },
    })

    const { user } = renderPage()

    await user.type(screen.getByLabelText(/nueva contrasena/i), 'NewSecure12!')
    await user.type(screen.getByLabelText(/confirmar contrasena/i), 'NewSecure12!')
    await user.click(screen.getByRole('button', { name: /establecer contrasena/i }))

    expect(mockNavigate).toHaveBeenCalledWith('/auth/verify', expect.objectContaining({
      state: expect.objectContaining({ email: 'user@test.com', session: 'new-session' }),
      replace: true,
    }))
  })

  it('displays error message on API failure', async () => {
    const { AuthRequestError } = await import('../authApi')
    mockRespondChallenge.mockRejectedValueOnce(new AuthRequestError({ code: 'AUTH_002', message: 'La contrasena no cumple con la politica definida', category: 'BAD_REQUEST' }))

    const { user } = renderPage()

    await user.type(screen.getByLabelText(/nueva contrasena/i), 'NewSecure12!')
    await user.type(screen.getByLabelText(/confirmar contrasena/i), 'NewSecure12!')
    await user.click(screen.getByRole('button', { name: /establecer contrasena/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La contrasena no cumple con la politica definida')
  })
})
