import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthRequestError, deleteUser } from '../auth/authApi'
import { getStoredAccessToken } from '../auth/authStorage'

export function DeleteUserPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  function handleRequestDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setShowConfirmation(true)
  }

  async function handleConfirmDelete() {
    setError(null)
    setIsSubmitting(true)

    const accessToken = getStoredAccessToken()
    if (!accessToken) {
      setError('No se encontro un token de sesion activo.')
      setIsSubmitting(false)
      return
    }

    try {
      await deleteUser({ email }, accessToken)
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
            Elimina un usuario del sistema. Esta accion es irreversible y eliminara la cuenta tanto
            de Cognito como de la base de datos local.
          </p>
        </div>
      </header>

      <article className="panel">
        <form className="delete-user-form" onSubmit={handleRequestDelete} noValidate>
          <div className="register-form-field">
            <label htmlFor="delete-user-email">Correo electronico del usuario</label>
            <input
              id="delete-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              autoComplete="off"
              required
              disabled={isSubmitting}
            />
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
