import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { addTeamMember, changeCoordinator, createTeam, getTeamMembers, getTeams, reassignTeamMember } from './teamsApi'
import type { Team, TeamMember } from './teamsApi'
import { teamMemberName } from './teamMemberName'

export function TeamsPage() {
  const { user } = useAuth()
  const isAdministrator = user?.roles.includes('ADMINISTRATOR') ?? false
  return user && (isAdministrator || user.roles.includes('COORDINATOR'))
    ? <TeamAdministration key={`${user.id}:${isAdministrator}`} isAdministrator={isAdministrator} />
    : <p role="alert">Solo el Administrador o Coordinador puede gestionar equipos.</p>
}

function TeamAdministration({ isAdministrator }: { isAdministrator: boolean }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [name, setName] = useState('')
  const [coordinatorEmail, setCoordinatorEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void getTeams(controller.signal).then(response => {
      if (!controller.signal.aborted) { setTeams(response); setIsLoading(false) }
    }).catch(error => {
      if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : 'No se pudieron cargar los equipos.'); setIsLoading(false) }
    })
    return () => controller.abort()
  }, [attempt])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (isSaving || !name.trim()) return
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const team = await createTeam(name.trim(), coordinatorEmail.trim())
      setTeams(previous => [...previous, team])
      setSelectedId(team.id)
      setName('')
      setCoordinatorEmail('')
      setSuccess('Equipo creado.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear el equipo.')
    } finally { setIsSaving(false) }
  }

  const selected = teams.find(team => team.id === selectedId)
  return <section className="page organization-settings">
    <header className="page-header"><div><p className="eyebrow">Administración</p><h2>Equipos</h2>
      <p className="page-copy">Las alertas de retraso se dirigen al coordinador vigente de cada equipo.</p></div></header>
    {error && <p className="feedback error" role="alert">{error}</p>}
    {success && <p className="feedback success" role="status">{success}</p>}
    {isLoading ? <p role="status">Cargando equipos…</p> : <>
      {error && <button className="secondary-button" onClick={() => { setError(''); setIsLoading(true); setAttempt(attempt + 1) }}>Recargar equipos</button>}
      {isAdministrator && <article className="panel form-panel"><h3>Crear equipo</h3>
        <form className="register-user-form" onSubmit={handleCreate}>
          <div className="task-form-field"><label htmlFor="team-name">Nombre del equipo</label><input id="team-name" value={name} required disabled={isSaving} onChange={event => setName(event.target.value)} /></div>
          <div className="task-form-field"><label htmlFor="team-coordinator">Correo del coordinador inicial</label><input id="team-coordinator" type="email" value={coordinatorEmail} required disabled={isSaving} onChange={event => setCoordinatorEmail(event.target.value)} /></div>
          <button className="primary-button" disabled={isSaving || !name.trim()}>{isSaving ? 'Creando…' : 'Crear equipo'}</button>
        </form>
      </article>}
      <article className="panel form-panel"><h3>Gestionar equipo</h3>
        {teams.length === 0 ? <p>{isAdministrator ? 'No hay equipos. Crea el primero para habilitar las tareas y alertas.' : 'No tienes equipos asignados. Solicita la asignación al Administrador.'}</p> : <>
          <div className="task-form-field"><label htmlFor="selected-team">Equipo</label><select id="selected-team" value={selectedId} onChange={event => setSelectedId(event.target.value)}>
            <option value="">Selecciona un equipo</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select></div>
          {selected && <TeamActions key={selected.id} team={selected} isAdministrator={isAdministrator} onCoordinatorChanged={updated => setTeams(previous => previous.map(team => team.id === updated.id ? updated : team))} />}
        </>}
      </article>
    </>}
  </section>
}

function TeamActions({ team, isAdministrator, onCoordinatorChanged }: { team: Team; isAdministrator: boolean; onCoordinatorChanged: (team: Team) => void }) {
  const [action, setAction] = useState<'coordinator' | 'member' | 'reassign'>(isAdministrator ? 'coordinator' : 'member')
  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [membersVersion, setMembersVersion] = useState(0)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSaving || !input.trim()) return
    setIsSaving(true)
    setMessage('')
    setError('')
    try {
      if (action === 'coordinator') onCoordinatorChanged(await changeCoordinator(team.id, input.trim()))
      else {
        await (action === 'member' ? addTeamMember : reassignTeamMember)(team.id, input.trim())
        setMembersVersion(version => version + 1)
      }
      setInput('')
      setMessage('Cambio guardado.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar el cambio.')
    } finally { setIsSaving(false) }
  }

  return <form className="register-user-form" onSubmit={handleSubmit}>
    <p>Coordinador actual: <strong>{team.coordinatorEmail}</strong></p>
    <TeamMembers teamId={team.id} version={membersVersion} />
    <div className="task-form-field"><label htmlFor="team-action">Acción</label><select id="team-action" value={action} disabled={isSaving} onChange={event => {
      const selected = event.target.value
      if (selected === 'coordinator' || selected === 'member' || selected === 'reassign') { setAction(selected); setInput(''); setMessage(''); setError('') }
    }}>
      {isAdministrator && <option value="coordinator">Cambiar coordinador</option>}<option value="member">Agregar colaborador al equipo</option>{isAdministrator && <option value="reassign">Reasignar colaborador a este equipo</option>}
    </select></div>
    <div className="task-form-field"><label htmlFor="team-action-value">Correo del usuario</label>
      <input id="team-action-value" type="email" required value={input} disabled={isSaving} onChange={event => setInput(event.target.value)} /></div>
    {action === 'member' && <p className="page-copy">Un colaborador puede pertenecer a varios equipos a la vez. Si ya pertenece a este equipo, el sistema lo indicará.</p>}
    {action === 'reassign' && <p className="page-copy">Mueve a un colaborador a este equipo. Deja de pertenecer a sus equipos anteriores y queda únicamente en este.</p>}
    <button className="primary-button" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar cambio'}</button>
    {message && <p className="feedback success" role="status">{message}</p>}{error && <p className="feedback error" role="alert">{error}</p>}
  </form>
}

function TeamMembers({ teamId, version }: { teamId: string; version: number }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError('')
    void getTeamMembers(teamId, controller.signal).then(response => {
      if (!controller.signal.aborted) setMembers(response)
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudieron cargar los colaboradores del equipo.')
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false)
    })
    return () => controller.abort()
  }, [teamId, version])

  return <section aria-labelledby="team-members-title"><h4 id="team-members-title">Colaboradores del equipo</h4>
    {isLoading ? <p role="status">Cargando colaboradores…</p> : error ? <p className="feedback error" role="alert">{error}</p>
      : members.length === 0 ? <p className="page-copy">Este equipo no tiene colaboradores.</p>
      : <ul className="team-member-list" aria-labelledby="team-members-title">{members.map(member => <li key={member.id}><strong>{teamMemberName(member)}</strong><span>{member.email}</span></li>)}</ul>}
  </section>
}
