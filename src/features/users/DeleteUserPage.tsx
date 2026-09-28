import { INVALID_EMAIL_MESSAGE, isValidEmail } from '../auth/emailValidation'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthRequestError, deleteUser } from '../auth/authApi'

export function DeleteUserPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  function handleRequestDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    if (!isValidEmail(email)) {
      setEmailError(INVALID_EMAIL_MESSAGE)
      return
    }
    setEmailError('')
    setError(null)
    setSuccess(null)
    setShowConfirmation(true)
  }

  async function handleConfirmDelete() {
    setError(null)
    setIsSubmitting(true)

    try {
      await deleteUser({ email })
      setSuccess(`El usuario ${email} ha sido eliminado correctamente.`)
      setEmail('')
      setShowConfirmation(false)
    } catch (requestError) {
      if (requestError instanceof AuthRequestError) {
        setError(requestError.message)
      } else {
        setError('Ocurrio un error inesperado. Intenta nuevamente.')
      }
      setShowConfirmation(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCancelDelete() {
    setShowConfirmation(false)
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Eliminar usuario</h2>
          <p className="page-copy">
            Elimina un usuario del sistema. Esta accion es irreversible y eliminara la cuenta y su acceso a la plataforma.
          </p>
        </div>
      </header>

      <article className="panel form-panel">
        <form className="delete-user-form" onSubmit={handleRequestDelete} noValidate>
          <div className="register-form-field">
            <label htmlFor="delete-user-email">Correo electronico del usuario</label>
            <input
              id="delete-user-email"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "delete-user-email-error" : undefined}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
              placeholder="usuario@empresa.com"
              autoComplete="off"
              required
              disabled={isSubmitting}
            />
          {emailError && <span id="delete-user-email-error" className="field-hint error" role="alert">{emailError}</span>}
          </div>

          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="feedback success" role="status">
              {success}
            </div>
          )}

          {showConfirmation ? (
            <div className="delete-confirmation">
              <p className="delete-confirmation-text">
                Estas seguro de eliminar al usuario <strong>{email}</strong>? Esta accion no se
                puede deshacer.
              </p>
              <div className="delete-confirmation-actions">
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => void handleConfirmDelete()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Eliminando...' : 'Confirmar eliminacion'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleCancelDelete}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              className="danger-button"
              disabled={!email || isSubmitting}
            >
              Eliminar usuario
            </button>
          )}
        </form>
      </article>
    </section>
  )
}
