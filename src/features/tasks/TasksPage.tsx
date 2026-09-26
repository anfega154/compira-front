import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TaskRequestError,
  approveTask,
  cancelTask,
  getManagedTasks,
  reassignTask,
} from './tasksApi'
import { TaskStatusBadge } from './TaskStatusBadge'
import { formatDateTime } from './taskLabels'
import type { Task } from './types'

export function TasksPage() {
  const navigate = useNavigate()
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
      const data = await getManagedTasks()
      setTasks(data)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(taskId: string) {
    setBusyTaskId(taskId)
    setActionMessage(null)
    setError(null)
    try {
      await approveTask(taskId)
      setActionMessage('Tarea aprobada y cerrada.')
      await loadTasks()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusyTaskId(null)
    }
  }

  async function handleCancel(taskId: string) {
    const reason = window.prompt('Motivo de la cancelacion (opcional):') ?? undefined
    setBusyTaskId(taskId)
    setActionMessage(null)
    setError(null)
    try {
      await cancelTask(taskId, { reason })
      setActionMessage('Tarea cancelada.')
      await loadTasks()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusyTaskId(null)
    }
  }

  async function handleReassign(taskId: string) {
    const newResponsibleEmail = window.prompt('Correo del nuevo responsable:')
    if (!newResponsibleEmail) return
    setBusyTaskId(taskId)
    setActionMessage(null)
    setError(null)
    try {
      await reassignTask(taskId, { newResponsibleEmail: newResponsibleEmail.trim() })
      setActionMessage('Tarea reasignada.')
      await loadTasks()
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
          <p className="eyebrow">Gestion de tareas</p>
          <h2>Tareas del equipo</h2>
          <p className="page-copy">Crea, asigna y da seguimiento a las tareas que gestionas.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => navigate('/tasks/create')}>
          Crear tarea
        </button>
      </header>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      {actionMessage ? <div className="feedback success" role="status">{actionMessage}</div> : null}

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Listado</h3>
            <p>Tareas creadas por ti (o de toda la organizacion si eres administrador).</p>
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
                  <td colSpan={4} className="empty-state">Todavia no hay tareas registradas.</td>
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
                      <button
                        type="button"
                        className="task-action-button"
                        onClick={() => void handleReassign(task.id)}
                        disabled={busyTaskId === task.id || task.status === 'CLOSED' || task.status === 'CANCELLED'}
                      >
                        Reasignar
                      </button>
                      <button
                        type="button"
                        className="task-action-button approve"
                        onClick={() => void handleApprove(task.id)}
                        disabled={busyTaskId === task.id || task.status !== 'COMPLETED'}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        className="task-action-button danger"
                        onClick={() => void handleCancel(task.id)}
                        disabled={busyTaskId === task.id || task.status === 'CLOSED' || task.status === 'CANCELLED'}
                      >
                        Cancelar
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
