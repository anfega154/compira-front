import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthRequestError, confirmPasswordRecovery, requestPasswordRecovery } from './authApi'
import { PasswordCriteriaTooltip } from './PasswordCriteriaTooltip'

type RecoveryStep = 'request' | 'confirm' | 'success'

const PASSWORD_MIN_LENGTH = 10
const PASSWORD_MAX_LENGTH = 128

export function PasswordRecoveryPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<RecoveryStep>('request')
  const [email, setEmail] = useState('')
  const [maskedDestination, setMaskedDestination] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await requestPasswordRecovery({ email })
      setMaskedDestination(response.codeDeliveryDetails.destination)
      setStep('confirm')
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

  async function handleConfirmRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await confirmPasswordRecovery({ email, confirmationCode, newPassword })
      setStep('success')
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

  if (step === 'success') {
    return (
      <div className="auth-form-panel">
        <div className="email-icon success-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <div className="auth-form-header">
          <h2>Contrasena actualizada</h2>
          <p>Tu contrasena ha sido restablecida correctamente. Ya puedes iniciar sesion con tu nueva contrasena.</p>
        </div>

        <button
          type="button"
          className="btn-auth-primary"
          onClick={() => navigate('/auth/login', { replace: true })}
        >
          Ir a iniciar sesion
        </button>
      </div>
    )
  }

  if (step === 'confirm') {
    const passwordsMatch = newPassword === confirmPassword
    const isValidLength = newPassword.length >= PASSWORD_MIN_LENGTH && newPassword.length <= PASSWORD_MAX_LENGTH
    const canSubmit = confirmationCode.length > 0 && isValidLength && passwordsMatch && !isSubmitting

    return (
      <div className="auth-form-panel">
        <div className="auth-form-header">
          <h2>Restablece tu contrasena</h2>
          <p>
            Enviamos un codigo de verificacion a <strong>{maskedDestination}</strong>. Ingresalo
            junto con tu nueva contrasena.
          </p>
        </div>

        <form onSubmit={handleConfirmRecovery} noValidate>
          <div className="form-group">
            <label htmlFor="recovery-code">Codigo de verificacion</label>
            <input
              id="recovery-code"
              type="text"
              inputMode="numeric"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Codigo de 6 digitos"
              autoComplete="one-time-code"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group password-field-wrapper">
            <label htmlFor="recovery-new-password">Nueva contrasena</label>
            <div className="input-wrapper">
              <input
                id="recovery-new-password"
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
            <label htmlFor="recovery-confirm-password">Confirmar contrasena</label>
            <input
              id="recovery-confirm-password"
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
            {isSubmitting ? 'Restableciendo...' : 'Restablecer contrasena'}
          </button>
        </form>

        <Link to="/auth/login" className="back-link">
          <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Volver al inicio de sesion
        </Link>
      </div>
    )
  }

  return (
    <div className="auth-form-panel">
      <div className="auth-form-header">
        <h2>Recuperar contrasena</h2>
        <p>Ingresa tu correo electronico y te enviaremos un codigo para restablecer tu contrasena.</p>
      </div>

      <form onSubmit={handleRequestCode} noValidate>
        <div className="form-group">
          <label htmlFor="recovery-email">Correo electronico</label>
          <input
            id="recovery-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@empresa.com"
            autoComplete="email"
            required
            disabled={isSubmitting}
          />
        </div>

        {error && (
          <div className="auth-feedback error" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-auth-primary"
          disabled={isSubmitting || !email}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar codigo'}
        </button>
      </form>

      <Link to="/auth/login" className="back-link">
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Volver al inicio de sesion
      </Link>
    </div>
  )
}
