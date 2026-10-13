import { env } from '../../config/env'
import { expireSession, getStoredAccessToken, isSessionExpired } from './authStorage'

export class ApiRequestError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message && message.trim().length > 0
      ? message
      : status === 401 ? 'La sesión venció. Inicia sesión nuevamente.'
      : status === 403 ? 'No tienes permiso para realizar esta acción.'
        : 'No se pudo completar la solicitud. Intenta nuevamente.')
    this.status = status
  }
}

async function extractErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.clone().json()
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const message = (body as { message: unknown }).message
      if (typeof message === 'string') return message
    }
  } catch {
    // El cuerpo no es JSON o está vacío: se usará el mensaje genérico por estado.
  }
  return undefined
}

export async function authenticatedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = getStoredAccessToken()
  if (!accessToken || isSessionExpired()) {
    expireSession(accessToken)
    throw new ApiRequestError(401)
  }
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${env.apiUrl}${path}`, { ...options, headers })
  if (response.status === 401) {
    expireSession(accessToken)
    throw new ApiRequestError(401)
  }
  return response
}

export async function authenticatedRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await authenticatedFetch(path, options)
  if (!response.ok) throw new ApiRequestError(response.status, await extractErrorMessage(response))
  return response
}
