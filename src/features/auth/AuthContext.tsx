import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { logout as logoutApi } from './authApi'
import { clearSession, expireSession, getSessionExpiration, getStoredAccessToken, getStoredUser, isSessionExpired, persistSession, SESSION_EXPIRED_EVENT } from './authStorage'
import type { AuthTokens, AuthUser } from './types'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  saveSession: (user: AuthUser, tokens: AuthTokens) => void
  endSession: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredAccessToken() && !isSessionExpired() ? getStoredUser() : null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    function clearExpiredUser() { setUser(null) }
    function checkSession() {
      clearTimeout(timer)
      const accessToken = getStoredAccessToken()
      if (!accessToken || isSessionExpired()) {
        expireSession(accessToken)
        return
      }
      const expiresAt = getSessionExpiration()
      if (expiresAt !== null) timer = setTimeout(checkSession, Math.min(expiresAt - Date.now(), 2_147_483_647))
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, clearExpiredUser)
    window.addEventListener('focus', checkSession)
    document.addEventListener('visibilitychange', checkSession)
    checkSession()
    return () => {
      clearTimeout(timer)
      window.removeEventListener(SESSION_EXPIRED_EVENT, clearExpiredUser)
      window.removeEventListener('focus', checkSession)
      document.removeEventListener('visibilitychange', checkSession)
    }
  }, [user])

  const isAuthenticated = user !== null

  const saveSession = useCallback((authUser: AuthUser, tokens: AuthTokens) => {
    persistSession(authUser, tokens)
    setUser(authUser)
  }, [])

  const endSession = useCallback(async () => {
    const accessToken = isSessionExpired() ? null : getStoredAccessToken()
    clearSession()
    setUser(null)

    if (accessToken) {
      try {
        await logoutApi({ accessToken })
      } catch {
        return
      }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, saveSession, endSession }),
    [user, isAuthenticated, saveSession, endSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
