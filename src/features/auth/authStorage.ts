import type { AuthTokens, AuthUser } from './types'

const STORAGE_KEYS = {
  accessToken: 'compira_access_token',
  idToken: 'compira_id_token',
  refreshToken: 'compira_refresh_token',
  user: 'compira_user',
  expiresAt: 'compira_expires_at',
} as const

export const SESSION_EXPIRED_EVENT = 'compira:session-expired'

export function persistSession(user: AuthUser, tokens: AuthTokens): void {
  sessionStorage.setItem(STORAGE_KEYS.accessToken, tokens.accessToken)
  sessionStorage.setItem(STORAGE_KEYS.idToken, tokens.idToken)
  sessionStorage.setItem(STORAGE_KEYS.refreshToken, tokens.refreshToken)
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
  sessionStorage.removeItem(STORAGE_KEYS.expiresAt)
  if (Number.isFinite(tokens.expiresIn)) {
    sessionStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + tokens.expiresIn * 1000))
  }
}

export function clearSession(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    sessionStorage.removeItem(key)
    localStorage.removeItem(key)
  }
}

export function expireSession(accessToken: string | null): void {
  if (getStoredAccessToken() !== accessToken) return
  const hasSession = accessToken !== null || sessionStorage.getItem(STORAGE_KEYS.user) !== null
  clearSession()
  if (hasSession) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export function getStoredAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.accessToken)
}

export function getSessionExpiration(): number | null {
  const storedExpiration = sessionStorage.getItem(STORAGE_KEYS.expiresAt)
  const expiresAt = storedExpiration !== null && Number.isFinite(Number(storedExpiration)) ? Number(storedExpiration) : null
  const tokenExpiration = getTokenExpiration(getStoredAccessToken())
  if (expiresAt === null) return tokenExpiration
  return tokenExpiration === null ? expiresAt : Math.min(expiresAt, tokenExpiration)
}

export function isSessionExpired(): boolean {
  const expiresAt = getSessionExpiration()
  return expiresAt !== null && expiresAt <= Date.now()
}

function getTokenExpiration(token: string | null): number | null {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof claims === 'object' && claims !== null && 'exp' in claims
      && typeof claims.exp === 'number' && Number.isFinite(claims.exp) ? claims.exp * 1000 : null
  } catch {
    return null
  }
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
