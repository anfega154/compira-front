import { env } from '../../config/env'
import { getStoredAccessToken } from './authStorage'

export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number) {
    super(status === 401 ? 'La sesión venció. Inicia sesión nuevamente.'
      : status === 403 ? 'No tienes permiso para realizar esta acción.'
        : 'No se pudo completar la solicitud. Intenta nuevamente.')
    this.status = status
  }
}

export function authorizationHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getStoredAccessToken() ?? ''}` }
}

export async function authenticatedRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    headers: { ...authorizationHeaders(), ...options.headers },
  })
  if (!response.ok) throw new ApiRequestError(response.status)
  return response
}
