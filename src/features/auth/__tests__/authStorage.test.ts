import { describe, expect, it } from 'vitest'
import { clearSession, getStoredAccessToken, getStoredUser, persistSession } from '../authStorage'
import type { AuthTokens, AuthUser } from '../types'

const mockUser: AuthUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  cognitoSub: 'abc123',
  email: 'test@empresa.com',
  firstName: 'Andres',
  lastName: 'Ganan',
  phoneNumber: '+573001234567',
  preferredMfaChannel: 'EMAIL',
  status: 'ACTIVE',
  roles: ['COORDINATOR'],
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-20T15:30:00Z',
  lastLoginAt: '2026-08-22T08:00:00Z',
}

const mockTokens: AuthTokens = {
  accessToken: 'access-token-value',
  idToken: 'id-token-value',
  refreshToken: 'refresh-token-value',
  expiresIn: 3600,
  tokenType: 'Bearer',
}

describe('authStorage', () => {
  describe('persistSession', () => {
    it('stores user and tokens in sessionStorage', () => {
      persistSession(mockUser, mockTokens)

      expect(sessionStorage.getItem('compira_access_token')).toBe('access-token-value')
      expect(sessionStorage.getItem('compira_id_token')).toBe('id-token-value')
      expect(sessionStorage.getItem('compira_refresh_token')).toBe('refresh-token-value')
      expect(sessionStorage.getItem('compira_user')).toBe(JSON.stringify(mockUser))
    })
  })

  describe('clearSession', () => {
    it('removes all auth keys from sessionStorage', () => {
      persistSession(mockUser, mockTokens)
      clearSession()

      expect(sessionStorage.getItem('compira_access_token')).toBeNull()
      expect(sessionStorage.getItem('compira_id_token')).toBeNull()
      expect(sessionStorage.getItem('compira_refresh_token')).toBeNull()
      expect(sessionStorage.getItem('compira_user')).toBeNull()
    })
  })

  describe('getStoredAccessToken', () => {
    it('returns the access token when stored', () => {
      persistSession(mockUser, mockTokens)

      expect(getStoredAccessToken()).toBe('access-token-value')
    })

    it('returns null when no token stored', () => {
      expect(getStoredAccessToken()).toBeNull()
    })
  })

  describe('getStoredUser', () => {
    it('returns parsed user when stored', () => {
      persistSession(mockUser, mockTokens)

      const user = getStoredUser()

      expect(user).toEqual(mockUser)
      expect(user?.email).toBe('test@empresa.com')
      expect(user?.roles).toContain('COORDINATOR')
    })

    it('returns null when no user stored', () => {
      expect(getStoredUser()).toBeNull()
    })

    it('returns null when stored value is invalid JSON', () => {
      sessionStorage.setItem('compira_user', 'invalid-json{{{')

      expect(getStoredUser()).toBeNull()
    })
  })
})
