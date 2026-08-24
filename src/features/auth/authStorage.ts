import type { AuthTokens, AuthUser } from './types'

const STORAGE_KEYS = {
  accessToken: 'compira_access_token',
  idToken: 'compira_id_token',
  refreshToken: 'compira_refresh_token',
  user: 'compira_user',
} as const

export function persistSession(user: AuthUser, tokens: AuthTokens): void {
  sessionStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken)
  sessionStorage.setItem(STORAGE_KEYS.idToken, tokens.idToken)
  sessionStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken)
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.accessToken)
  sessionStorage.removeItem(STORAGE_KEYS.idToken)
  sessionStorage.removeItem(STORAGE_KEYS.refreshToken)
  sessionStorage.removeItem(STORAGE_KEYS.user)
}

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.accessToken)
}

export function getStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem(STORAGE_KEYS.user)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}
