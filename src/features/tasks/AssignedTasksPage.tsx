import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TaskRequestError,
  addObservation,
  getAssignedTasks,
  updateTaskStatus,
} from './tasksApi'
import { TaskActionModal } from './TaskActionModal'
import { TaskStatusBadge } from './TaskStatusBadge'
import { formatDateTime } from './taskLabels'
import type { CollaboratorTargetStatus, Task, TaskStatus } from './types'

function SkeletonRows({ columns, rows = 4 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr className="skeleton-row" key={rowIndex} aria-hidden="true">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex}>
              <span className="skeleton skeleton-line" style={{ width: colIndex === 0 ? '70%' : '50%', display: 'block' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

const NEXT_STATUS_ACTIONS: Record<string, { label: string; target: CollaboratorTargetStatus }[]> = {
  PENDING: [{ label: 'Iniciar', target: 'IN_PROGRESS' }],
  IN_PROGRESS: [
    { label: 'Completar', target: 'COMPLETED' },
    { label: 'Volver a pendiente', target: 'PENDING' },
  ],
  DELAYED: [
    { label: 'Iniciar', target: 'IN_PROGRESS' },
    { label: 'Completar', target: 'COMPLETED' },
  ],
  COMPLETED: [{ label: 'Reabrir', target: 'IN_PROGRESS' }],
}

const STATUS_FILTERS: { value: TaskStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'DELAYED', label: 'Retrasadas' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'CLOSED', label: 'Cerradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

export function AssignedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL')

  const [observationTask, setObservationTask] = useState<Task | null>(null)

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

  async function handleAddObservation(taskId: string, content: string) {
    setActionMessage(null)
    setError(null)
    await addObservation(taskId, { content })
    setActionMessage('Observacion registrada.')
  }

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (statusFilter !== 'ALL' && task.status !== statusFilter) return false
      if (term && !task.title.toLowerCase().includes(term)) return false
      return true
    })
  }, [tasks, search, statusFilter])

  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'ALL'

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

        <div className="filter-bar">
          <div className="filter-search">
            <svg viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por título"
              aria-label="Buscar tareas por título"
            />
          </div>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as TaskStatus | 'ALL')}
            aria-label="Filtrar por estado"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="filter-chips">
            {search.trim() && (
              <span className="filter-chip">
                Búsqueda: {search.trim()}
                <button type="button" aria-label="Quitar filtro de búsqueda" onClick={() => setSearch('')}>
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="filter-chip">
                Estado: {STATUS_FILTERS.find((option) => option.value === statusFilter)?.label}
                <button type="button" aria-label="Quitar filtro de estado" onClick={() => setStatusFilter('ALL')}>
                  <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </span>
            )}
            <button type="button" className="filter-clear" onClick={() => { setSearch(''); setStatusFilter('ALL') }}>
              Limpiar filtros
            </button>
          </div>
        )}

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
              {loading ? <SkeletonRows columns={4} /> : null}

              {!loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">No tienes tareas asignadas.</td>
                </tr>
              ) : null}

              {!loading && tasks.length > 0 && filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">Ninguna tarea coincide con los filtros aplicados.</td>
                </tr>
              ) : null}

              {!loading && filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                  </td>
                  <td><TaskStatusBadge status={task.status} overdue={task.overdue} /></td>
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
                        onClick={() => setObservationTask(task)}
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
      {observationTask && <TaskActionModal action="observation" taskTitle={observationTask.title}
        onSubmit={value => handleAddObservation(observationTask.id, value)} onClose={() => setObservationTask(null)} />}
    </section>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TaskRequestError) {
    return error.message
  }
  return 'Ocurrio un error inesperado. Intenta nuevamente.'
}
