import { getTeamMembers, getTeams } from '../teams/teamsApi'
import type { Team, TeamMember } from '../teams/teamsApi'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CharacterCounter } from '../../app/CharacterCounter'
import { ResponsibleCombobox } from './ResponsibleCombobox'
import { TaskRequestError, createTask } from './tasksApi'

const TITLE_MAX_LENGTH = 150
const DESCRIPTION_MAX_LENGTH = 2000

export function CreateTaskPage() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [membersFailed, setMembersFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void getTeams(controller.signal).then(response => {
      if (!controller.signal.aborted) setTeams(response)
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudieron cargar los equipos.')
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    setMembers([])
    setMembersFailed(false)
    setError(null)
    if (!teamId) {
      setIsLoadingMembers(false)
      return
    }
    const controller = new AbortController()
    setIsLoadingMembers(true)
    getTeamMembers(teamId, controller.signal).then(response => {
      if (!controller.signal.aborted) setMembers(response)
    }).catch(requestError => {
      if (controller.signal.aborted) return
      setMembersFailed(true)
      setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los colaboradores del equipo.')
    }).finally(() => {
      if (!controller.signal.aborted) setIsLoadingMembers(false)
    })
    return () => controller.abort()
  }, [teamId])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [responsibleEmail, setResponsibleEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canSubmit = teamId !== ''
    && title.trim().length > 0
    && description.trim().length > 0
    && dueDate !== ''
    && !isSubmitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setError(null)
    setSuccess(null)
    setIsSubmitting(true)

    try {
      const task = await createTask({
        teamId,
        title: title.trim(),
        description: description.trim(),
        dueDate: new Date(dueDate).toISOString(),
        responsibleEmail: responsibleEmail.trim() ? responsibleEmail.trim() : undefined,
      })
      setSuccess(`Tarea "${task.title}" creada correctamente.`)
      setTitle('')
      setDescription('')
      setDueDate('')
      setResponsibleEmail('')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Gestion de tareas</p>
          <h2>Crear tarea</h2>
          <p className="page-copy">
            Define una nueva tarea con su información básica y asígnala a un colaborador.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => navigate('/tasks')}>
          Ver tareas
        </button>
      </header>

      <article className="panel form-panel">
        <form className="register-user-form" onSubmit={handleSubmit} noValidate>
          <p className="form-section-title">Información de la tarea</p>
          <div className="task-form-grid">
            <div className="task-form-field full">
              <label htmlFor="task-team">Equipo</label>
              <select id="task-team" value={teamId} required disabled={isSubmitting} onChange={event => {
                setTeamId(event.target.value)
                setResponsibleEmail('')
              }}>
                <option value="">Selecciona un equipo</option>
                {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              {teams.length === 0 && <p className="field-hint">Necesitas un equipo asignado por el Administrador para crear tareas.</p>}
            </div>
            <div className="task-form-field full">
              <label htmlFor="task-title">Título</label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Preparar informe mensual"
                maxLength={TITLE_MAX_LENGTH}
                aria-describedby="task-title-counter"
                required
                disabled={isSubmitting}
              />
              <CharacterCounter id="task-title-counter" length={title.length} max={TITLE_MAX_LENGTH} />
            </div>

            <div className="task-form-field full">
              <label htmlFor="task-description">Descripción</label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe qué hay que hacer"
                maxLength={DESCRIPTION_MAX_LENGTH}
                aria-describedby="task-description-counter"
                required
                disabled={isSubmitting}
              />
              <CharacterCounter id="task-description-counter" length={description.length} max={DESCRIPTION_MAX_LENGTH} />
            </div>
          </div>

          <p className="form-section-title">Asignación y programación</p>
          <div className="task-form-grid">
            <div className="task-form-field">
              <label htmlFor="task-responsible">Responsable (opcional)</label>
              <ResponsibleCombobox
                id="task-responsible"
                members={members}
                value={responsibleEmail}
                onChange={setResponsibleEmail}
                isLoading={isLoadingMembers}
                disabled={!teamId || membersFailed || isSubmitting}
                placeholder={teamId ? 'Buscar colaborador…' : 'Selecciona primero un equipo'}
              />
            </div>

            <div className="task-form-field">
              <label htmlFor="task-due-date">Fecha límite</label>
              <input
                id="task-due-date"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                disabled={isSubmitting}
              />
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
            {isSubmitting ? 'Creando tarea...' : 'Crear tarea'}
          </button>
        </form>
      </article>
    </section>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TaskRequestError) {
    return error.message
  }
  return 'Ocurrió un error inesperado. Intenta nuevamente.'
}
