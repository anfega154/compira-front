import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthRequestError,
  confirmPasswordRecovery,
  deleteUser,
  login,
  logout,
  registerUser,
  requestPasswordRecovery,
  resendLoginCode,
  respondChallenge,
} from '../authApi'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function noContentResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.resolve(null),
    text: () => Promise.resolve(''),
  })
}

describe('authApi', () => {
  describe('login', () => {
    it('sends email and password and returns auth response', async () => {
      const authResponse = { status: 'AUTHENTICATED', user: { id: '1' }, tokens: { accessToken: 'abc' }, challenge: null }
      mockFetch.mockReturnValueOnce(jsonResponse(authResponse))

      const result = await login({ email: 'user@test.com', password: 'Pass123!' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@test.com', password: 'Pass123!' }),
        }),
      )
      expect(result.status).toBe('AUTHENTICATED')
    })

    it('throws AuthRequestError on 401', async () => {
      const errorBody = { code: 'AUTH_005', message: 'Las credenciales ingresadas no son validas', category: 'UNAUTHORIZED' }
      mockFetch.mockReturnValueOnce(jsonResponse(errorBody, 401))

      await expect(login({ email: 'user@test.com', password: 'wrong' })).rejects.toThrow(AuthRequestError)
    })

    it('AuthRequestError contains code and category', async () => {
      const errorBody = { code: 'AUTH_005', message: 'Credenciales invalidas', category: 'UNAUTHORIZED' }
      mockFetch.mockReturnValueOnce(jsonResponse(errorBody, 401))

      try {
        await login({ email: 'a@b.com', password: 'x' })
      } catch (error) {
        expect(error).toBeInstanceOf(AuthRequestError)
        const authError = error as InstanceType<typeof AuthRequestError>
        expect(authError.code).toBe('AUTH_005')
        expect(authError.category).toBe('UNAUTHORIZED')
        expect(authError.message).toBe('Credenciales invalidas')
      }
    })
  })

  describe('respondChallenge', () => {
    it('sends challenge response with code', async () => {
      const authResponse = { status: 'AUTHENTICATED', user: { id: '1' }, tokens: { accessToken: 'x' }, challenge: null }
      mockFetch.mockReturnValueOnce(jsonResponse(authResponse))

      const result = await respondChallenge({
        email: 'user@test.com',
        session: 'session-token',
        challengeName: 'EMAIL_OTP',
        code: '123456',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login/challenge'),
        expect.objectContaining({ method: 'POST' }),
      )
      expect(result.status).toBe('AUTHENTICATED')
    })

    it('sends challenge response with newPassword', async () => {
      const challengeResponse = { status: 'CHALLENGE_REQUIRED', user: null, tokens: null, challenge: { challengeName: 'EMAIL_OTP', session: 'new-session' } }
      mockFetch.mockReturnValueOnce(jsonResponse(challengeResponse))

      const result = await respondChallenge({
        email: 'user@test.com',
        session: 'session-token',
        challengeName: 'NEW_PASSWORD_REQUIRED',
        newPassword: 'NewPass1234!',
      })

      expect(result.status).toBe('CHALLENGE_REQUIRED')
    })
  })

  describe('resendLoginCode', () => {
    it('sends email and returns delivery details', async () => {
      const response = { codeDeliveryDetails: { destination: 'u***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' } }
      mockFetch.mockReturnValueOnce(jsonResponse(response))

      const result = await resendLoginCode({ email: 'user@test.com' })

      expect(result.codeDeliveryDetails.destination).toBe('u***@test.com')
    })

    it('throws on too many requests', async () => {
      const errorBody = { code: 'AUTH_013', message: 'Demasiadas solicitudes', category: 'TOO_MANY_REQUESTS' }
      mockFetch.mockReturnValueOnce(jsonResponse(errorBody, 429))

      await expect(resendLoginCode({ email: 'user@test.com' })).rejects.toThrow(AuthRequestError)
    })
  })

  describe('logout', () => {
    it('sends accessToken and handles 204 response', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse())

      await expect(logout({ accessToken: 'my-token' })).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ accessToken: 'my-token' }),
        }),
      )
    })
  })

  describe('requestPasswordRecovery', () => {
    it('sends email and returns delivery details', async () => {
      const response = { codeDeliveryDetails: { destination: 'u***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' } }
      mockFetch.mockReturnValueOnce(jsonResponse(response))

      const result = await requestPasswordRecovery({ email: 'user@test.com' })

      expect(result.codeDeliveryDetails.deliveryMedium).toBe('EMAIL')
    })
  })

  describe('confirmPasswordRecovery', () => {
    it('sends confirmation payload and handles 204', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse())

      await expect(
        confirmPasswordRecovery({ email: 'user@test.com', confirmationCode: '123456', newPassword: 'NewPass1234!' }),
      ).resolves.toBeUndefined()
    })

    it('throws on invalid code', async () => {
      const errorBody = { code: 'AUTH_003', message: 'El codigo de confirmacion es invalido', category: 'BAD_REQUEST' }
      mockFetch.mockReturnValueOnce(jsonResponse(errorBody, 400))

      await expect(
        confirmPasswordRecovery({ email: 'user@test.com', confirmationCode: '000000', newPassword: 'NewPass1234!' }),
      ).rejects.toThrow('El codigo de confirmacion es invalido')
    })
  })

  describe('registerUser', () => {
    it('sends registration payload with auth header', async () => {
      const response = { cognitoSub: 'sub-123', userConfirmed: false, codeDeliveryDetails: { destination: 'n***@test.com', deliveryMedium: 'EMAIL', attributeName: 'email' } }
      mockFetch.mockReturnValueOnce(jsonResponse(response, 201))

      const result = await registerUser(
        { email: 'new@test.com', password: 'Temp1234!*', firstName: 'Ana', lastName: 'Lopez', phoneNumber: '+573001234567', preferredMfaChannel: 'EMAIL' },
        'admin-token',
      )

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer admin-token' },
        }),
      )
      expect(result.cognitoSub).toBe('sub-123')
    })

    it('throws on duplicate email', async () => {
      const errorBody = { code: 'AUTH_001', message: 'Ya existe una cuenta registrada con este correo electronico', category: 'CONFLICT' }
      mockFetch.mockReturnValueOnce(jsonResponse(errorBody, 409))

      await expect(
        registerUser({ email: 'dup@test.com', password: 'x', firstName: 'A', lastName: 'B', phoneNumber: '+571', preferredMfaChannel: 'EMAIL' }, 'token'),
      ).rejects.toThrow('Ya existe una cuenta registrada')
    })
  })

  describe('deleteUser', () => {
    it('sends DELETE request with email and auth header', async () => {
      mockFetch.mockReturnValueOnce(noContentResponse())

      await expect(deleteUser({ email: 'del@test.com' }, 'admin-token')).resolves.toBeUndefined()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/users'),
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer admin-token' },
          body: JSON.stringify({ email: 'del@test.com' }),
        }),
      )
    })

    it('throws on user not found', async () => {
      const errorBody = { code: 'AUTH_007', message: 'No se encontro una cuenta asociada al usuario enviado', category: 'NOT_FOUND' }
      mockFetch.mockReturnValueOnce(jsonResponse(errorBody, 404))

      await expect(deleteUser({ email: 'nobody@test.com' }, 'token')).rejects.toThrow('No se encontro')
    })
  })
})
