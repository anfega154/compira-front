import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthRequestError, respondChallenge } from './authApi'
import { PasswordCriteriaTooltip } from './PasswordCriteriaTooltip'
import { useAuth } from './useAuth'
import type { AuthChallenge } from './types'

type LocationState = {
  email: string
  session: string
  challenge: AuthChallenge
}

const PASSWORD_MIN_LENGTH = 10
const PASSWORD_MAX_LENGTH = 128

export function NewPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { saveSession } = useAuth()

  const state = location.state as LocationState | null

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  if (!state?.email || !state?.session) {
    return <Navigate to="/auth/login" replace />
  }

  const passwordsMatch = newPassword === confirmPassword
  const isValidLength = newPassword.length >= PASSWORD_MIN_LENGTH && newPassword.length <= PASSWORD_MAX_LENGTH
  const canSubmit = isValidLength && passwordsMatch && !isSubmitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit || !state) return

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await respondChallenge({
        email: state.email,
        session: state.session,
        challengeName: 'NEW_PASSWORD_REQUIRED',
        newPassword,
      })

      if (response.status === 'AUTHENTICATED' && response.user && response.tokens) {
        saveSession(response.user, response.tokens)
        navigate('/', { replace: true })
        return
      }

      if (response.status === 'CHALLENGE_REQUIRED' && response.challenge) {
        const nextState = {
          email: state.email,
          session: response.challenge.session,
          challenge: response.challenge,
        }
        navigate('/auth/verify', { state: nextState, replace: true })
      }
    } catch (requestError) {
      if (requestError instanceof AuthRequestError) {
        setError(requestError.message)
      } else {
        setError('Ocurrio un error inesperado. Intenta nuevamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-form-panel">
      <div className="auth-form-header">
        <h2>Crea tu nueva contrasena</h2>
        <p>
          Es tu primer inicio de sesion. Por seguridad, debes establecer una contrasena personal
          para tu cuenta.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group password-field-wrapper">
          <label htmlFor="new-password">Nueva contrasena</label>
          <div className="input-wrapper">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 10 caracteres"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
              disabled={isSubmitting}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          <PasswordCriteriaTooltip password={newPassword} visible={isPasswordFocused} />
        </div>

        <div className="form-group">
          <label htmlFor="confirm-password">Confirmar contrasena</label>
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu nueva contrasena"
            autoComplete="new-password"
            required
            disabled={isSubmitting}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <span className="field-hint error">Las contrasenas no coinciden</span>
          )}
        </div>

        {error && (
          <div className="auth-feedback error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn-auth-primary" disabled={!canSubmit}>
          {isSubmitting ? 'Guardando...' : 'Establecer contrasena'}
        </button>
      </form>
    </div>
  )
}
