import { createContext, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { logout as logoutApi } from './authApi'
import { clearSession, getStoredAccessToken, getStoredUser, persistSession } from './authStorage'
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
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)

  const isAuthenticated = user !== null

  const saveSession = useCallback((authUser: AuthUser, tokens: AuthTokens) => {
    persistSession(authUser, tokens)
    setUser(authUser)
  }, [])

  const endSession = useCallback(async () => {
    const accessToken = getStoredAccessToken()
    clearSession()
    setUser(null)

    if (accessToken) {
      try {
        await logoutApi({ accessToken })
      } catch {
        // Session cleared locally regardless of backend response
      }
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated, saveSession, endSession }),
    [user, isAuthenticated, saveSession, endSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
