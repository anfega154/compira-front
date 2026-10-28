import { authenticatedFetch } from '../auth/authenticatedRequest'
import type { UserRole } from '../auth/types'

/**
 * Directory and administration of organization users, backed by the server
 * endpoints handled by UserAdminHandler (Administrator-only, HU-40 + HU-10):
 *   - GET  /users                 → list organization users
 *   - PUT  /users/roles           → update a user's roles
 *   - POST /users/password-reset  → reset a user's temporary password
 *   - POST /users/status          → activate/deactivate a user (logical, DEC-019)
 * The response shape mirrors the backend `UserResponse` record; no fields are
 * invented.
 */
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

export type SetUserStatusPayload = {
  email: string
  active: boolean
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

export async function getUsers(signal?: AbortSignal): Promise<OrganizationUser[]> {
  const response = await authenticatedFetch(usersUrl, { method: 'GET', signal })
  return handleResponse<OrganizationUser[]>(response)
}

/** Backward-compatible alias (used by earlier code paths). */
export const getOrganizationUsers = getUsers

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

export async function setUserStatus(payload: SetUserStatusPayload): Promise<OrganizationUser> {
  const response = await authenticatedFetch(`${usersUrl}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<OrganizationUser>(response)
}
