import { env } from '../../config/env'
import type {
  AuthApiError,
  AuthResponse,
  ChallengeRequest,
  DeleteUserRequest,
  LoginRequest,
  LogoutRequest,
  PasswordRecoveryConfirmRequest,
  PasswordRecoveryRequest,
  PasswordRecoveryResponse,
  RegisterUserRequest,
  RegisterUserResponse,
  ResendCodeRequest,
  ResendCodeResponse,
} from './types'

class AuthRequestError extends Error {
  readonly code: AuthApiError['code']
  readonly category: AuthApiError['category']

  constructor(apiError: AuthApiError) {
    super(apiError.message)
    this.name = 'AuthRequestError'
    this.code = apiError.code
    this.category = apiError.category
  }
}

export { AuthRequestError }

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json()

  if (!response.ok) {
    throw new AuthRequestError(body as AuthApiError)
  }

  return body as T
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${env.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleResponse<AuthResponse>(response)
}

export async function respondChallenge(payload: ChallengeRequest): Promise<AuthResponse> {
  const response = await fetch(`${env.apiUrl}/auth/login/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleResponse<AuthResponse>(response)
}

export async function resendLoginCode(payload: ResendCodeRequest): Promise<ResendCodeResponse> {
  const response = await fetch(`${env.apiUrl}/auth/login/resend-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleResponse<ResendCodeResponse>(response)
}

export async function logout(payload: LogoutRequest): Promise<void> {
  const response = await fetch(`${env.apiUrl}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleResponse<void>(response)
}

export async function requestPasswordRecovery(
  payload: PasswordRecoveryRequest,
): Promise<PasswordRecoveryResponse> {
  const response = await fetch(`${env.apiUrl}/auth/password-recovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleResponse<PasswordRecoveryResponse>(response)
}

export async function confirmPasswordRecovery(
  payload: PasswordRecoveryConfirmRequest,
): Promise<void> {
  const response = await fetch(`${env.apiUrl}/auth/password-recovery/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return handleResponse<void>(response)
}

export async function registerUser(
  payload: RegisterUserRequest,
  accessToken: string,
): Promise<RegisterUserResponse> {
  const response = await fetch(`${env.apiUrl}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<RegisterUserResponse>(response)
}

export async function deleteUser(
  payload: DeleteUserRequest,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`${env.apiUrl}/auth/users`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<void>(response)
}
