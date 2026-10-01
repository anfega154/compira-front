import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { UserRole } from '../auth/types'
import {
  UserRequestError,
  getOrganizationUsers,
  resetUserPassword,
  updateUserRoles,
} from './usersApi'
import type { OrganizationUser } from './usersApi'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'ADMINISTRATOR', label: 'Administrador' },
  { value: 'COORDINATOR', label: 'Coordinador' },
  { value: 'COLLABORATOR', label: 'Colaborador' },
]

const ROLE_LABELS: Record<UserRole, string> = {
  ADMINISTRATOR: 'Administrador',
  COORDINATOR: 'Coordinador',
  COLLABORATOR: 'Colaborador',
}

const PASSWORD_MIN_LENGTH = 10

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString()
}

export function UsersPage() {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [users, setUsers] = useState<OrganizationUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void loadUsers(controller)
    return () => controller.abort()
  }, [])

  async function loadUsers(controller?: AbortController) {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await getOrganizationUsers()
      if (!controller?.signal.aborted) setUsers(data)
    } catch (error) {
      if (!controller?.signal.aborted) {
        setLoadError(error instanceof UserRequestError ? error.message : 'No se pudieron cargar los usuarios.')
      }
    } finally {
      if (!controller?.signal.aborted) setIsLoading(false)
    }
  }

  function handleUserUpdated(updated: OrganizationUser) {
    setUsers(previous => previous.map(user => (user.id === updated.id ? updated : user)))
  }

  const selectedUser = users.find(user => user.email === selectedEmail) ?? null

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h2 ref={headingRef} tabIndex={-1}>Usuarios</h2>
          <p className="page-copy">Consulta los usuarios de la organización y administra sus roles o restablece su contraseña.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void loadUsers()} disabled={isLoading}>
          {isLoading ? 'Consultando…' : 'Recargar'}
        </button>
      </header>

      {loadError ? <div className="feedback error" role="alert">{loadError}</div> : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Listado de usuarios</h3>
            <p>Usuarios de la organización con su rol y equipo asignado.</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Roles</th>
                <th>Equipo</th>
                <th>Estado</th>
                <th>Último ingreso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="empty-state" role="status">Cargando usuarios…</td>
                </tr>
              ) : null}

              {!isLoading && users.length === 0 && !loadError ? (
                <tr>
                  <td colSpan={7} className="empty-state">No hay usuarios registrados en la organización.</td>
                </tr>
              ) : null}

              {!isLoading && users.map(user => (
                <tr key={user.id}>
                  <td>{`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—'}</td>
                  <td>{user.email}</td>
                  <td>{user.roles.map(role => ROLE_LABELS[role] ?? role).join(' · ') || '—'}</td>
                  <td>{user.teamName ?? '—'}</td>
                  <td>{user.status}</td>
                  <td>{formatDateTime(user.lastLoginAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="task-action-button"
                      aria-expanded={selectedEmail === user.email}
                      onClick={() => setSelectedEmail(current => (current === user.email ? null : user.email))}
                    >
                      {selectedEmail === user.email ? 'Cerrar' : 'Editar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {selectedUser ? (
        <EditUserPanel
          key={selectedUser.id}
          user={selectedUser}
          onUserUpdated={handleUserUpdated}
          onClose={() => {
            setSelectedEmail(null)
            headingRef.current?.focus()
          }}
        />
      ) : null}
    </section>
  )
}

type EditUserPanelProps = {
  user: OrganizationUser
  onUserUpdated: (user: OrganizationUser) => void
  onClose: () => void
}

function EditUserPanel({ user, onUserUpdated, onClose }: EditUserPanelProps) {
  const [roles, setRoles] = useState<UserRole[]>(user.roles)
  const [isSavingRoles, setIsSavingRoles] = useState(false)
  const [rolesMessage, setRolesMessage] = useState<string | null>(null)
  const [rolesError, setRolesError] = useState<string | null>(null)

  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)

  function toggleRole(role: UserRole) {
    setRolesMessage(null)
    setRolesError(null)
    setRoles(current => (current.includes(role) ? current.filter(item => item !== role) : [...current, role]))
  }

  async function handleRolesSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSavingRoles) return
    if (roles.length === 0) {
      setRolesError('El usuario debe conservar al menos un rol.')
      return
    }
    setIsSavingRoles(true)
    setRolesMessage(null)
    setRolesError(null)
    try {
      const updated = await updateUserRoles({ email: user.email, roles })
      onUserUpdated(updated)
      setRoles(updated.roles)
      setRolesMessage('Roles actualizados.')
    } catch (error) {
      setRolesError(error instanceof UserRequestError ? error.message : 'No se pudieron actualizar los roles.')
    } finally {
      setIsSavingRoles(false)
    }
  }

  async function handleResetSubmit(event: FormEvent) {
    event.preventDefault()
    if (isResetting) return
    setIsResetting(true)
    setResetMessage(null)
    setResetError(null)
    try {
      await resetUserPassword({ email: user.email, temporaryPassword })
      setTemporaryPassword('')
      setResetMessage('Contraseña temporal restablecida. El usuario deberá cambiarla en su próximo ingreso.')
    } catch (error) {
      setResetError(error instanceof UserRequestError ? error.message : 'No se pudo restablecer la contraseña.')
    } finally {
      setIsResetting(false)
    }
  }

  const canReset = temporaryPassword.length >= PASSWORD_MIN_LENGTH && !isResetting

  return (
    <article className="panel form-panel" aria-label={`Editar usuario ${user.email}`}>
      <div className="panel-header">
        <div>
          <h3>Editar {user.firstName} {user.lastName}</h3>
          <p>{user.email}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>Cerrar edición</button>
      </div>

      <form className="register-user-form" onSubmit={handleRolesSubmit}>
        <fieldset className="task-form-field">
          <legend>Roles</legend>
          {ROLE_OPTIONS.map(option => (
            <label key={option.value} className="checkbox-field">
              <input
                type="checkbox"
                checked={roles.includes(option.value)}
                disabled={isSavingRoles}
                onChange={() => toggleRole(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <button type="submit" className="primary-button" disabled={isSavingRoles || roles.length === 0}>
          {isSavingRoles ? 'Guardando…' : 'Guardar roles'}
        </button>
        {rolesMessage ? <p className="feedback success" role="status">{rolesMessage}</p> : null}
        {rolesError ? <p className="feedback error" role="alert">{rolesError}</p> : null}
      </form>

      <form className="register-user-form" onSubmit={handleResetSubmit}>
        <div className="task-form-field">
          <label htmlFor="reset-temporary-password">Nueva contraseña temporal</label>
          <input
            id="reset-temporary-password"
            type="password"
            value={temporaryPassword}
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="off"
            disabled={isResetting}
            onChange={event => { setTemporaryPassword(event.target.value); setResetMessage(null); setResetError(null) }}
          />
          <span className="field-hint">Mínimo {PASSWORD_MIN_LENGTH} caracteres. El usuario la cambiará al iniciar sesión.</span>
        </div>
        <button type="submit" className="secondary-button" disabled={!canReset}>
          {isResetting ? 'Restableciendo…' : 'Restablecer contraseña'}
        </button>
        {resetMessage ? <p className="feedback success" role="status">{resetMessage}</p> : null}
        {resetError ? <p className="feedback error" role="alert">{resetError}</p> : null}
      </form>
    </article>
  )
}
