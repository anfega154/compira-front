import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, ClipboardEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { env } from '../../config/env'
import { AuthRequestError, resendLoginCode, respondChallenge } from './authApi'
import { useAuth } from './useAuth'
import type { AuthChallenge } from './types'

type LocationState = {
  email: string
  session: string
  challenge: AuthChallenge
}

const OTP_LENGTH = 6

export function OtpVerificationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { saveSession } = useAuth()

  const state = location.state as LocationState | null

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(env.otpResendCooldownSeconds)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendCooldown <= 0) return

    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [resendCooldown])

  const focusInput = useCallback((index: number) => {
    inputRefs.current[index]?.focus()
  }, [])

  if (!state?.email || !state?.session) {
    return <Navigate to="/auth/login" replace />
  }

  const code = digits.join('')
  const isCodeComplete = code.length === OTP_LENGTH
  const canSubmit = isCodeComplete && !isSubmitting
  const canResend = resendCooldown <= 0 && !isResending

  const maskedEmail = state.challenge.codeDeliveryDetails?.destination ?? state.email

  function handleDigitChange(index: number, value: string) {
    if (value.length > 1) return

    const isDigit = /^\d$/.test(value)
    if (value && !isDigit) return

    const updated = [...digits]
    updated[index] = value
    setDigits(updated)
    setError(null)

    if (value && index < OTP_LENGTH - 1) {
      focusInput(index + 1)
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1)
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)

    if (!pasted) return

    const updated = [...digits]
    for (let i = 0; i < OTP_LENGTH; i++) {
      updated[i] = pasted[i] ?? ''
    }
    setDigits(updated)
    setError(null)

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1)
    focusInput(focusIndex)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSubmit || !state) return

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await respondChallenge({
        email: state.email,
        session: state.session,
        challengeName: state.challenge.challengeName,
        code,
      })

      if (response.status === 'AUTHENTICATED' && response.user && response.tokens) {
        saveSession(response.user, response.tokens)
        navigate('/', { replace: true })
      }
    } catch (requestError) {
      if (requestError instanceof AuthRequestError) {
        setError(requestError.message)
      } else {
        setError('Ocurrio un error inesperado. Intenta nuevamente.')
      }
      setDigits(Array(OTP_LENGTH).fill(''))
      focusInput(0)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    if (!canResend || !state) return

    setIsResending(true)
    setError(null)

    try {
      await resendLoginCode({ email: state.email })
      setResendCooldown(env.otpResendCooldownSeconds)
      setDigits(Array(OTP_LENGTH).fill(''))
      focusInput(0)
    } catch (requestError) {
      if (requestError instanceof AuthRequestError) {
        setError(requestError.message)
      } else {
        setError('No se pudo reenviar el codigo.')
      }
    } finally {
      setIsResending(false)
    }
  }

  const minutes = Math.floor(resendCooldown / 60)
  const seconds = resendCooldown % 60
  const formattedCooldown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="auth-form-panel">
      <div className="step-indicator">
        <div className="step step-completed" aria-label="Paso 1 completado">&#10003;</div>
        <div className="step-connector completed" />
        <div className="step step-active" aria-label="Paso 2 actual">2</div>
      </div>
      <div className="step-labels">
        <span className="step-label">Credenciales</span>
        <span className="step-label active">Verificacion</span>
      </div>

      <div className="email-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>

      <div className="auth-form-header">
        <h2>Verifica tu identidad</h2>
        <p>
          Hemos enviado un codigo de 6 digitos a tu correo electronico{' '}
          <strong>{maskedEmail}</strong>. Ingresalo a continuacion para completar el inicio de
          sesion.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="code-inputs" role="group" aria-label="Codigo de verificacion">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              className={`code-input${digit ? ' filled' : ''}`}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              aria-label={`Digito ${index + 1}`}
              autoFocus={index === 0}
              disabled={isSubmitting}
            />
          ))}
        </div>

        {error && (
          <div className="auth-feedback error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn-auth-primary" disabled={!canSubmit}>
          {isSubmitting ? 'Verificando...' : 'Verificar codigo'}
        </button>
      </form>

      <div className="resend-section">
        <p className="resend-text">No recibiste el codigo?</p>
        {canResend ? (
          <button
            type="button"
            className="resend-link"
            onClick={() => void handleResend()}
            disabled={isResending}
          >
            <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {isResending ? 'Reenviando...' : 'Reenviar codigo'}
          </button>
        ) : (
          <p className="timer">Puedes reenviar en {formattedCooldown}</p>
        )}
      </div>

      <Link to="/auth/login" className="back-link">
        <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Volver al inicio de sesion
      </Link>

      <div className="auth-security-note">
        <svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        Doble factor de autenticacion activo
      </div>
    </div>
  )
}
