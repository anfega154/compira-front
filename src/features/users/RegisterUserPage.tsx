import { useState } from 'react'
import type { FormEvent } from 'react'
import { AuthRequestError, registerUser } from '../auth/authApi'
import { getStoredAccessToken } from '../auth/authStorage'
import { PasswordCriteriaTooltip } from '../auth/PasswordCriteriaTooltip'
import { phoneCountryCodes } from '../auth/phoneCountryCodes'
import type { UserRole } from '../auth/types'

type FormState = {
  email: string
  password: string
  firstName: string
  lastName: string
  countryCode: string
  phoneNumber: string
  roleCode: UserRole
}

const initialForm: FormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  countryCode: '+57',
  phoneNumber: '',
  roleCode: 'COLLABORATOR',
}

const PASSWORD_MIN_LENGTH = 10

export function RegisterUserPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const fullPhoneNumber = `${form.countryCode}${form.phoneNumber}`

  const canSubmit =
    form.email.length > 0 &&
    form.password.length >= PASSWORD_MIN_LENGTH &&
    form.firstName.length > 0 &&
    form.lastName.length > 0 &&
    form.phoneNumber.length > 0 &&
    !isSubmitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    const accessToken = getStoredAccessToken()
    if (!accessToken) {
      setError('No se encontro un token de sesion activo.')
      setIsSubmitting(false)
      return
    }

    try {
      await registerUser(
        {
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          phoneNumber: fullPhoneNumber,
          preferredMfaChannel: 'EMAIL',
          roleCode: form.roleCode,
        },
        accessToken,
      )

      setSuccess(`Usuario ${form.email} creado correctamente. Recibira un correo con las instrucciones.`)
      setForm(initialForm)
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
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Registrar usuario</h2>
          <p className="page-copy">
            Crea un nuevo usuario en el sistema. El usuario debera cambiar su contrasena temporal en
            el primer inicio de sesion.
          </p>
        </div>
      </header>

      <article className="panel">
        <form className="register-user-form" onSubmit={handleSubmit} noValidate>
          <div className="register-form-grid">
            <div className="register-form-field">
              <label htmlFor="register-first-name">Nombre</label>
              <input
                id="register-first-name"
                type="text"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="Maria"
                maxLength={100}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="register-form-field">
              <label htmlFor="register-last-name">Apellido</label>
              <input
                id="register-last-name"
                type="text"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder="Lopez"
                maxLength={100}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="register-form-field">
              <label htmlFor="register-email">Correo electronico</label>
              <input
                id="register-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="usuario@empresa.com"
                autoComplete="off"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="register-form-field">
              <label htmlFor="register-phone">Telefono</label>
              <div className="phone-input-group">
                <select
                  id="register-country-code"
                  className="phone-country-select"
                  value={form.countryCode}
                  onChange={(e) => updateField('countryCode', e.target.value)}
                  disabled={isSubmitting}
                  aria-label="Codigo de pais"
                >
                  {phoneCountryCodes.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>
                <input
                  id="register-phone"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => updateField('phoneNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="3001234567"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="register-form-field password-field-wrapper">
              <label htmlFor="register-password">Contrasena temporal</label>
              <input
                id="register-password"
                type="text"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="Ej: Andres5592770*"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={128}
                autoComplete="off"
                required
                disabled={isSubmitting}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
              />
              <PasswordCriteriaTooltip password={form.password} visible={isPasswordFocused} />
              <span className="field-hint">El usuario la cambiara en su primer inicio de sesion</span>
            </div>

            <div className="register-form-field">
              <label htmlFor="register-role">Rol</label>
              <select
                id="register-role"
                value={form.roleCode}
                onChange={(e) => updateField('roleCode', e.target.value as UserRole)}
                disabled={isSubmitting}
              >
                <option value="COLLABORATOR">Colaborador</option>
                <option value="COORDINATOR">Coordinador</option>
                <option value="ADMINISTRATOR">Administrador</option>
              </select>
            </div>
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

          <button type="submit" className="primary-button" disabled={!canSubmit}>
            {isSubmitting ? 'Creando usuario...' : 'Crear usuario'}
          </button>
        </form>
      </article>
    </section>
  )
}
