import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { addTeamMember, changeCoordinator, createTeam, getTeams, linkExistingTask } from './teamsApi'
import type { Team } from './teamsApi'

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
  const [action, setAction] = useState<'coordinator' | 'member' | 'task'>(isAdministrator ? 'coordinator' : 'member')
  const [input, setInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isSaving || !input.trim()) return
    setIsSaving(true)
    setMessage('')
    setError('')
    try {
      if (action === 'coordinator') onCoordinatorChanged(await changeCoordinator(team.id, input.trim()))
      else if (action === 'member') await addTeamMember(team.id, input.trim())
      else await linkExistingTask(team.id, input.trim())
      setInput('')
      setMessage('Cambio guardado.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar el cambio.')
    } finally { setIsSaving(false) }
  }

  return <form className="register-user-form" onSubmit={handleSubmit}>
    <p>Coordinador actual: <strong>{team.coordinatorEmail}</strong></p>
    <div className="task-form-field"><label htmlFor="team-action">Acción</label><select id="team-action" value={action} disabled={isSaving} onChange={event => {
      const selected = event.target.value
      if (selected === 'coordinator' || selected === 'member' || selected === 'task') { setAction(selected); setInput(''); setMessage(''); setError('') }
    }}>
      {isAdministrator && <option value="coordinator">Cambiar coordinador</option>}<option value="member">Vincular colaborador sin equipo</option><option value="task">Vincular tarea existente sin equipo</option>
    </select></div>
    <div className="task-form-field"><label htmlFor="team-action-value">{action === 'task' ? 'Identificador de la tarea' : 'Correo del usuario'}</label>
      <input id="team-action-value" type={action === 'task' ? 'text' : 'email'} required value={input} disabled={isSaving} onChange={event => setInput(event.target.value)} /></div>
    {action === 'task' && <p className="page-copy">Las tareas anteriores no tienen equipo. Vincula primero al responsable y luego registra aquí el identificador de su tarea.</p>}
    <button className="primary-button" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar cambio'}</button>
    {message && <p className="feedback success" role="status">{message}</p>}{error && <p className="feedback error" role="alert">{error}</p>}
  </form>
}
