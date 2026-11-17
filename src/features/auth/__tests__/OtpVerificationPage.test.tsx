import { act, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../AuthContext'
import { OtpVerificationPage } from '../OtpVerificationPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../authApi', () => ({
  respondChallenge: vi.fn(),
  resendLoginCode: vi.fn(),
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

vi.mock('../../../config/env', () => ({
  env: { apiUrl: 'http://localhost:8080/api/v1', otpResendCooldownSeconds: 0 },
}))

import { resendLoginCode, respondChallenge } from '../authApi'

const mockRespondChallenge = vi.mocked(respondChallenge)
const mockResendLoginCode = vi.mocked(resendLoginCode)

const validState = {
  email: 'user@test.com',
  session: 'session-abc',
  challenge: { challengeName: 'EMAIL_OTP', session: 'session-abc', availableMfaChannels: ['EMAIL'], codeDeliveryDetails: { destination: 'u***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' } },
}

function renderPage(state: unknown = validState) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/auth/verify', state }]}>
      <AuthProvider>
        <OtpVerificationPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

function fillOtpInputs(code: string) {
  const inputs = screen.getAllByRole('textbox')
  code.split('').forEach((digit, index) => {
    fireEvent.change(inputs[index], { target: { value: digit } })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('OtpVerificationPage', () => {
  it('renders verification form with step indicator', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: /verifica tu identidad/i })).toBeInTheDocument()
    expect(screen.getByText(/u\*\*\*@test\.com/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /codigo de verificacion/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verificar codigo/i })).toBeInTheDocument()
  })

  it('redirects to login when no state', () => {
    render(
      <MemoryRouter initialEntries={['/auth/verify']}>
        <AuthProvider>
          <OtpVerificationPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('heading', { name: /verifica tu identidad/i })).not.toBeInTheDocument()
  })

  it('has a back to login link', () => {
    renderPage()

    expect(screen.getByRole('link', { name: /volver al inicio de sesion/i })).toBeInTheDocument()
  })

  it('disables verify button until all 6 digits are entered', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /verificar codigo/i })).toBeDisabled()

    fillOtpInputs('123456')

    expect(screen.getByRole('button', { name: /verificar codigo/i })).toBeEnabled()
  })

  it('verifies code and navigates to / on success', async () => {
    mockRespondChallenge.mockResolvedValueOnce({
      status: 'AUTHENTICATED',
      user: { id: '1', cognitoSub: 's', email: 'user@test.com', firstName: 'A', lastName: 'B', phoneNumber: '+57', preferredMfaChannel: 'EMAIL', status: 'ACTIVE', roles: ['COORDINATOR'], createdAt: '', updatedAt: '', lastLoginAt: '' },
      tokens: { accessToken: 'tok', idToken: 'id', refreshToken: 'ref', expiresIn: 3600, tokenType: 'Bearer' },
      challenge: null,
    })

    renderPage()

    fillOtpInputs('242756')
    fireEvent.click(screen.getByRole('button', { name: /verificar codigo/i }))

    await vi.waitFor(() => {
      expect(mockRespondChallenge).toHaveBeenCalledWith({
        email: 'user@test.com',
        session: 'session-abc',
        challengeName: 'EMAIL_OTP',
        code: '242756',
      })
    })

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })

  it('displays error on invalid code', async () => {
    const { AuthRequestError } = await import('../authApi')
    mockRespondChallenge.mockRejectedValueOnce(new AuthRequestError({ code: 'AUTH_003', message: 'El codigo de confirmacion es invalido', category: 'BAD_REQUEST' }))

    renderPage()

    fillOtpInputs('000000')
    fireEvent.click(screen.getByRole('button', { name: /verificar codigo/i }))

    await vi.waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El codigo de confirmacion es invalido')
    })
  })

  it('shows resend button when cooldown is zero', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /reenviar codigo/i })).toBeInTheDocument()
  })

  it('calls resendLoginCode when resend button is clicked', async () => {
    mockResendLoginCode.mockResolvedValueOnce({ codeDeliveryDetails: { destination: 'u***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' } })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /reenviar codigo/i }))

    await vi.waitFor(() => {
      expect(mockResendLoginCode).toHaveBeenCalledWith({ email: 'user@test.com' })
    })
  })
})
