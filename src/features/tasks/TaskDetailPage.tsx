import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  TaskRequestError,
  getObservations,
  getTask,
  getTaskHistory,
} from './tasksApi'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TASK_EVENT_LABELS, formatDateTime } from './taskLabels'
import type { Task, TaskHistoryEntry, TaskObservation } from './types'
import { useAuth } from '../auth/useAuth'

export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const { user } = useAuth()
  const isManager = user?.roles.some((role) => role === 'ADMINISTRATOR' || role === 'COORDINATOR') ?? false
  const backPath = isManager ? '/tasks' : '/tasks/assigned'
  const [task, setTask] = useState<Task | null>(null)
  const [observations, setObservations] = useState<TaskObservation[]>([])
  const [history, setHistory] = useState<TaskHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return
    void loadDetail(taskId)
  }, [taskId])

  async function loadDetail(id: string) {
    setLoading(true)
    setError(null)
    try {
      const taskData = await getTask(id)
      setTask(taskData)
      const [observationsData, historyData] = await Promise.all([
        getObservations(id).catch(() => []),
        getTaskHistory(id).catch(() => []),
      ])
      setObservations(observationsData)
      setHistory(historyData)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <section className="page">
        <p className="page-copy">Cargando tarea...</p>
        <article className="panel">
          <div className="skeleton skeleton-line" style={{ width: '40%', height: 18 }} />
          <div className="skeleton skeleton-line" style={{ width: '100%', height: 120, marginTop: 16 }} />
        </article>
      </section>
    )
  }

  if (error || !task) {
    return (
      <section className="page">
        <div className="feedback error" role="alert">{error ?? 'No se encontro la tarea.'}</div>
        <Link to={backPath} className="secondary-button" style={{ alignSelf: 'flex-start' }}>
          Volver a tareas
        </Link>
      </section>
    )
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Detalle de tarea</p>
          <h2>{task.title}</h2>
          <p className="page-copy">{task.description ?? 'Sin descripcion'}</p>
        </div>
        <TaskStatusBadge status={task.status} overdue={task.overdue} />
      </header>

      <div className="task-detail-grid">
        <article className="panel">
          <div className="panel-header">
            <div><h3>Informacion</h3></div>
          </div>
          <dl className="detail-info-list">
            <div className="detail-info-item">
              <span className="detail-label">Fecha limite</span>
              <span className="detail-value">{formatDateTime(task.dueDate)}</span>
            </div>
            <div className="detail-info-item">
              <span className="detail-label">Estado</span>
              <span className="detail-value"><TaskStatusBadge status={task.status} /></span>
            </div>
            <div className="detail-info-item">
              <span className="detail-label">Creada</span>
              <span className="detail-value">{formatDateTime(task.createdAt)}</span>
            </div>
            <div className="detail-info-item">
              <span className="detail-label">Ultima actualizacion</span>
              <span className="detail-value">{formatDateTime(task.updatedAt)}</span>
            </div>
          </dl>

          <h3 style={{ marginTop: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>Observaciones</h3>
          {observations.length === 0 ? (
            <p className="page-copy">No hay observaciones registradas.</p>
          ) : (
            <ul className="observation-list">
              {observations.map((observation) => (
                <li key={observation.id}>
                  <div>{observation.content}</div>
                  <div className="observation-meta">{formatDateTime(observation.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <div><h3>Historial y trazabilidad</h3></div>
          </div>
          {history.length === 0 ? (
            <p className="page-copy">No hay eventos en el historial (o no tienes acceso a el).</p>
          ) : (
            <ul className="task-timeline">
              {history.map((entry) => (
                <li key={entry.id}>
                  <div className="event-title">{TASK_EVENT_LABELS[entry.event]}</div>
                  <div className="event-meta">{formatDateTime(entry.createdAt)}</div>
                  {renderChange(entry)}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <Link to={backPath} className="secondary-button" style={{ alignSelf: 'flex-start' }}>
        Volver a tareas
      </Link>
    </section>
  )
}

function renderChange(entry: TaskHistoryEntry) {
  if (entry.previousValue && entry.newValue) {
    return <div className="event-detail">{entry.previousValue} → {entry.newValue}</div>
  }
  if (entry.newValue) {
    return <div className="event-detail">{entry.newValue}</div>
  }
  if (entry.detail) {
    return <div className="event-detail">{entry.detail}</div>
  }
  return null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TaskRequestError) {
    return error.message
  }
  return 'Ocurrio un error inesperado. Intenta nuevamente.'
}
