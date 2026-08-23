import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthRequestError, login } from './authApi'
import { useAuth } from './useAuth'
import type { AuthChallenge } from './types'

export function LoginPage() {
  const navigate = useNavigate()
  const { saveSession } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await login({ email, password })

      if (response.status === 'AUTHENTICATED' && response.user && response.tokens) {
        saveSession(response.user, response.tokens)
        navigate('/', { replace: true })
        return
      }

      if (response.status === 'CHALLENGE_REQUIRED' && response.challenge) {
        navigateToChallenge(response.challenge)
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  function navigateToChallenge(challenge: AuthChallenge) {
    const state = { email, session: challenge.session, challenge }

    if (challenge.challengeName === 'NEW_PASSWORD_REQUIRED') {
      navigate('/auth/new-password', { state })
      return
    }

    if (challenge.challengeName === 'EMAIL_OTP' || challenge.challengeName === 'SMS_MFA') {
      navigate('/auth/verify', { state })
    }
  }

  return (
    <div className="auth-form-panel">
      <div className="auth-form-header">
        <h2>Iniciar sesion</h2>
        <p>Ingresa tus credenciales para acceder a la plataforma</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="login-email">Correo electronico</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            autoComplete="email"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="login-password">Contrasena</label>
          <div className="input-wrapper">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contrasena"
              autoComplete="current-password"
              required
              disabled={isSubmitting}
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
        </div>

        <div className="form-options">
          <Link to="/auth/password-recovery" className="forgot-password-link">
            Recuperar contrasena
          </Link>
        </div>

        {error && (
          <div className="auth-feedback error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-auth-primary"
          disabled={isSubmitting || !email || !password}
        >
          {isSubmitting ? 'Ingresando...' : 'Iniciar sesion'}
        </button>
      </form>

      <p className="auth-footer-note">
        El sistema asignara tu rol automaticamente al iniciar sesion.
      </p>

      <div className="auth-security-note">
        <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
        </svg>
        Conexion protegida con doble factor de autenticacion
      </div>
    </div>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) {
    return error.message
  }

  return 'Ocurrio un error inesperado. Intenta nuevamente.'
}
