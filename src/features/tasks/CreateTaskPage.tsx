import { getOrganizationSettings } from '../organization/organizationApi'
import { getTeamMembers, getTeams } from '../teams/teamsApi'
import type { Team, TeamMember } from '../teams/teamsApi'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CharacterCounter } from '../../app/CharacterCounter'
import { Toast } from '../../app/Toast'
import { ResponsibleCombobox } from './ResponsibleCombobox'
import { TaskRequestError, createTask } from './tasksApi'
import { formatTimeZoneLabel, getDeviceTimeZone } from './timeZone'
import { PAST_DUE_DATE_MESSAGE, getMinDueDate, getSubmitHint, isPastDueDate } from './taskFormRules'

const TITLE_MAX_LENGTH = 150
const DESCRIPTION_MAX_LENGTH = 2000

export function CreateTaskPage() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [teamsLoaded, setTeamsLoaded] = useState(false)
  const [organizationTimeZone, setOrganizationTimeZone] = useState<string | null>(null)
  const [teamId, setTeamId] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [membersFailed, setMembersFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void getTeams(controller.signal).then(response => {
      if (!controller.signal.aborted) {
        setTeams(response)
        setTeamsLoaded(true)
      }
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudieron cargar los equipos.')
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    getOrganizationSettings(controller.signal).then(settings => {
      if (!controller.signal.aborted) setOrganizationTimeZone(settings.timeZone)
    }).catch(() => undefined)
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
  const [createdTask, setCreatedTask] = useState<{ id: string; title: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const closeToast = useCallback(() => setCreatedTask(null), [])

  useEffect(() => {
    if (createdTask) titleRef.current?.focus()
  }, [createdTask])

  const [now, setNow] = useState(() => new Date())
  const deviceTimeZone = getDeviceTimeZone()
  const hasDifferentOrganizationZone = organizationTimeZone !== null && organizationTimeZone !== deviceTimeZone
  const [isHintOpen, setIsHintOpen] = useState(false)

  const isDueDatePast = isPastDueDate(dueDate, now)
  const canSubmit = teamId !== ''
    && title.trim().length > 0
    && description.trim().length > 0
    && dueDate !== ''
    && !isDueDatePast
    && !isSubmitting
  const submitHint = canSubmit || isSubmitting
    ? null
    : getSubmitHint({ teamId, title, description, dueDate, now, hasTeams: !teamsLoaded || teams.length > 0 })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    const submittedAt = new Date()
    setNow(submittedAt)
    if (isPastDueDate(dueDate, submittedAt)) return

    setError(null)
    setCreatedTask(null)
    setIsSubmitting(true)

    try {
      const task = await createTask({
        teamId,
        title: title.trim(),
        description: description.trim(),
        dueDate: new Date(dueDate).toISOString(),
        responsibleEmail: responsibleEmail.trim() ? responsibleEmail.trim() : undefined,
      })
      setCreatedTask({ id: task.id, title: task.title })
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
                ref={titleRef}
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
                onFocus={() => setNow(new Date())}
                min={getMinDueDate(now)}
                aria-invalid={isDueDatePast}
                aria-describedby={isDueDatePast ? 'task-due-date-error' : undefined}
                required
                disabled={isSubmitting}
              />
              {isDueDatePast && <p id="task-due-date-error" className="field-error">{PAST_DUE_DATE_MESSAGE}</p>}
              <p className="field-hint">Hora de tu dispositivo: {formatTimeZoneLabel(deviceTimeZone, now)}</p>
              {hasDifferentOrganizationZone && (
                <p className="field-hint field-warning">
                  Tu organización usa {formatTimeZoneLabel(organizationTimeZone, now)}. La fecha se guardará con la hora de tu dispositivo.
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="feedback error" role="alert">
              {error}
            </div>
          )}

          <div className="submit-area">
            <span
              className="submit-hint-wrapper"
              tabIndex={submitHint ? 0 : undefined}
              onMouseEnter={() => setIsHintOpen(true)}
              onMouseLeave={() => setIsHintOpen(false)}
              onFocus={() => setIsHintOpen(true)}
              onBlur={() => setIsHintOpen(false)}
            >
              <button
                type="submit"
                className="primary-button"
                disabled={!canSubmit}
                aria-describedby={submitHint ? 'task-submit-hint' : undefined}
              >
                {isSubmitting ? 'Creando tarea...' : 'Crear tarea'}
              </button>
              {submitHint && isHintOpen && <span role="tooltip" className="tooltip">{submitHint}</span>}
            </span>
            {submitHint && <p id="task-submit-hint" className="submit-hint-text">{submitHint}</p>}
          </div>
        </form>
      </article>
      {createdTask && (
        <Toast
          message={`Tarea "${createdTask.title}" creada correctamente.`}
          action={{ label: 'Ver tarea', to: `/tasks/${createdTask.id}` }}
          onClose={closeToast}
        />
      )}
    </section>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TaskRequestError) {
    return error.message
  }
  return 'Ocurrió un error inesperado. Intenta nuevamente.'
}
