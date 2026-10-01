import { authenticatedFetch } from '../auth/authenticatedRequest'
import type { UserRole } from '../auth/types'

export type OrganizationUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  status: string
  roles: UserRole[]
  teamId: string | null
  teamName: string | null
  createdAt: string | null
  lastLoginAt: string | null
}

export type UpdateRolesPayload = {
  email: string
  roles: UserRole[]
}

export type ResetPasswordPayload = {
  email: string
  temporaryPassword: string
}

export class UserRequestError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'UserRequestError'
    this.code = code
  }
}

const usersUrl = '/users'

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }
  const body: unknown = await response.json()
  if (!response.ok) {
    const apiError = body as { code?: string; message?: string }
    throw new UserRequestError(apiError.code ?? 'USER_ERROR', apiError.message ?? 'No se pudo completar la solicitud.')
  }
  return body as T
}

export async function getOrganizationUsers(): Promise<OrganizationUser[]> {
  const response = await authenticatedFetch(usersUrl, { method: 'GET' })
  return handleResponse<OrganizationUser[]>(response)
}

export async function updateUserRoles(payload: UpdateRolesPayload): Promise<OrganizationUser> {
  const response = await authenticatedFetch(`${usersUrl}/roles`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return handleResponse<OrganizationUser>(response)
}

export async function resetUserPassword(payload: ResetPasswordPayload): Promise<void> {
  const response = await authenticatedFetch(`${usersUrl}/password-reset`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<void>(response)
}
