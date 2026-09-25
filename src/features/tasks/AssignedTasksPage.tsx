import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TaskRequestError,
  addObservation,
  getAssignedTasks,
  updateTaskStatus,
} from './tasksApi'
import { TaskStatusBadge } from './TaskStatusBadge'
import { formatDateTime } from './taskLabels'
import type { CollaboratorTargetStatus, Task } from './types'

const NEXT_STATUS_ACTIONS: Record<string, { label: string; target: CollaboratorTargetStatus }[]> = {
  PENDING: [{ label: 'Iniciar', target: 'IN_PROGRESS' }],
  IN_PROGRESS: [
    { label: 'Completar', target: 'COMPLETED' },
    { label: 'Volver a pendiente', target: 'PENDING' },
  ],
  DELAYED: [
    { label: 'Retomar', target: 'IN_PROGRESS' },
    { label: 'Completar', target: 'COMPLETED' },
  ],
  COMPLETED: [{ label: 'Reabrir', target: 'IN_PROGRESS' }],
}

export function AssignedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)

  useEffect(() => {
    void loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      const data = await getAssignedTasks()
      setTasks(data)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(taskId: string, target: CollaboratorTargetStatus) {
    setBusyTaskId(taskId)
    setActionMessage(null)
    setError(null)
    try {
      await updateTaskStatus(taskId, { status: target })
      setActionMessage('Estado actualizado.')
      await loadTasks()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusyTaskId(null)
    }
  }

  async function handleAddObservation(taskId: string) {
    const content = window.prompt('Escribe tu observacion:')
    if (!content || !content.trim()) return
    setBusyTaskId(taskId)
    setActionMessage(null)
    setError(null)
    try {
      await addObservation(taskId, { content: content.trim() })
      setActionMessage('Observacion registrada.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusyTaskId(null)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Mis tareas</p>
          <h2>Tareas asignadas</h2>
          <p className="page-copy">Consulta y actualiza el estado de las tareas de las que eres responsable.</p>
        </div>
      </header>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      {actionMessage ? <div className="feedback success" role="status">{actionMessage}</div> : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Listado</h3>
            <p>Solo se muestran las tareas donde eres el responsable vigente.</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => void loadTasks()} disabled={loading}>
            {loading ? 'Consultando...' : 'Recargar'}
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Titulo</th>
                <th>Estado</th>
                <th>Fecha limite</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">No tienes tareas asignadas.</td>
                </tr>
              ) : null}

              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                  </td>
                  <td><TaskStatusBadge status={task.status} /></td>
                  <td>{formatDateTime(task.dueDate)}</td>
                  <td>
                    <div className="task-actions">
                      {(NEXT_STATUS_ACTIONS[task.status] ?? []).map((action) => (
                        <button
                          key={action.target}
                          type="button"
                          className="task-action-button"
                          onClick={() => void handleStatusChange(task.id, action.target)}
                          disabled={busyTaskId === task.id}
                        >
                          {action.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="task-action-button"
                        onClick={() => void handleAddObservation(task.id)}
                        disabled={busyTaskId === task.id}
                      >
                        Observacion
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
