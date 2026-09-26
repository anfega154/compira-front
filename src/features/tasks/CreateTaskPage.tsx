import { getTeams } from '../teams/teamsApi'
import type { Team } from '../teams/teamsApi'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { TaskRequestError, createTask } from './tasksApi'

const TITLE_MAX_LENGTH = 150
const DESCRIPTION_MAX_LENGTH = 2000

export function CreateTaskPage() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void getTeams(controller.signal).then(response => {
      if (!controller.signal.aborted) setTeams(response)
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudieron cargar los equipos.')
    })
    return () => controller.abort()
  }, [])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [responsibleEmail, setResponsibleEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canSubmit = title.trim().length > 0 && teamId !== '' && !isSubmitting

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
        description: description.trim() ? description.trim() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
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
            Define una nueva tarea con su informacion basica y asignala a un colaborador.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => navigate('/tasks')}>
          Ver tareas
        </button>
      </header>

      <article className="panel">
        <form className="register-user-form" onSubmit={handleSubmit} noValidate>
          <div className="task-form-grid">
            <div className="task-form-field full">
              <label htmlFor="task-team">Equipo</label>
              <select id="task-team" value={teamId} required disabled={isSubmitting} onChange={event => setTeamId(event.target.value)}>
                <option value="">Selecciona un equipo que coordinas</option>
                {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              {teams.length === 0 && <p>Necesitas un equipo asignado por el Administrador para crear tareas.</p>}
            </div>
            <div className="task-form-field full">
              <label htmlFor="task-title">Titulo</label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Preparar informe mensual"
                maxLength={TITLE_MAX_LENGTH}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="task-form-field full">
              <label htmlFor="task-description">Descripcion</label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalle de la tarea (opcional)"
                maxLength={DESCRIPTION_MAX_LENGTH}
                disabled={isSubmitting}
              />
            </div>

            <div className="task-form-field">
              <label htmlFor="task-due-date">Fecha limite</label>
              <input
                id="task-due-date"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="task-form-field">
              <label htmlFor="task-responsible">Responsable (correo)</label>
              <input
                id="task-responsible"
                type="email"
                value={responsibleEmail}
                onChange={(e) => setResponsibleEmail(e.target.value)}
                placeholder="colaborador@empresa.com"
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
  return 'Ocurrio un error inesperado. Intenta nuevamente.'
}
