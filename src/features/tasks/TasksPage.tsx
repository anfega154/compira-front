import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TaskRequestError,
  approveTask,
  cancelTask,
  getManagedTasks,
  getTaskIndicators,
  reassignTask,
} from './tasksApi'
import { TaskActionModal } from './TaskActionModal'
import { TaskStatusBadge } from './TaskStatusBadge'
import { TASK_STATUS_LABELS, formatDateTime } from './taskLabels'
import type { Task, TaskIndicators, TaskStatus } from './types'
import { useAuth } from '../auth/useAuth'
import { canManageTaskLifecycle } from '../auth/permissions'

const STATUS_FILTER_OPTIONS: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CLOSED', 'CANCELLED']

export function TasksPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManageTasks = canManageTaskLifecycle(user)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [indicators, setIndicators] = useState<TaskIndicators | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)

  const [taskAction, setTaskAction] = useState<{ task: Task; action: 'reassign' | 'cancel' } | null>(null)

  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [responsibleFilter, setResponsibleFilter] = useState<string>('')
  const [dueFrom, setDueFrom] = useState<string>('')
  const [dueTo, setDueTo] = useState<string>('')

  useEffect(() => {
    void loadTasks()
  }, [])

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      const [data, indicatorsData] = await Promise.all([getManagedTasks(), getTaskIndicators()])
      setTasks(data)
      setIndicators(indicatorsData)
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

  async function handleTaskAction(taskId: string, action: 'reassign' | 'cancel', value: string) {
    setActionMessage(null)
    setError(null)
    if (action === 'reassign') {
      await reassignTask(taskId, { newResponsibleEmail: value })
      setActionMessage('Tarea reasignada.')
    } else {
      await cancelTask(taskId, { reason: value || undefined })
      setActionMessage('Tarea cancelada.')
    }
    await loadTasks()
  }

  const responsibleLabels = new Map<string, string>()
  for (const workload of indicators?.workloadByAssignee ?? []) {
    responsibleLabels.set(workload.assigneeId, workload.assigneeName ?? workload.assigneeEmail ?? workload.assigneeId)
  }
  for (const assignee of indicators?.assignees ?? []) {
    responsibleLabels.set(assignee.id, assignee.name ?? assignee.email ?? assignee.id)
  }

  const responsibleOptions = Array.from(
    new Set(tasks.map(task => task.responsibleUserId).filter((id): id is string => id !== null)),
  ).map(id => ({ id, label: responsibleLabels.get(id) ?? id }))
    .sort((left, right) => left.label.localeCompare(right.label))

  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'DELAYED') {
      if (!task.overdue) return false
    } else if (statusFilter && task.status !== statusFilter) {
      return false
    }
    if (responsibleFilter && task.responsibleUserId !== responsibleFilter) return false
    if (dueFrom && (!task.dueDate || task.dueDate < dueFrom)) return false
    if (dueTo && (!task.dueDate || task.dueDate > `${dueTo}T23:59:59`)) return false
    return true
  })

  const hasActiveFilters = Boolean(statusFilter || responsibleFilter || dueFrom || dueTo)

  function clearFilters() {
    setStatusFilter('')
    setResponsibleFilter('')
    setDueFrom('')
    setDueTo('')
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Gestion de tareas</p>
          <h2 ref={headingRef} tabIndex={-1}>Tareas del equipo</h2>
          <p className="page-copy">{canManageTasks ? 'Crea, asigna y da seguimiento a las tareas que gestionas.' : 'Consulta y da seguimiento a las tareas de la organización.'}</p>
        </div>
        {canManageTasks && (
          <button type="button" className="primary-button" onClick={() => navigate('/tasks/create')}>
            Crear tarea
          </button>
        )}
      </header>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}
      {actionMessage ? <div className="feedback success" role="status">{actionMessage}</div> : null}

      {indicators ? <TaskIndicatorsPanel indicators={indicators} /> : null}

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

        <div className="task-filters" role="group" aria-label="Filtros del panel">
          <div className="task-form-field">
            <label htmlFor="filter-status">Estado</label>
            <select id="filter-status" value={statusFilter} onChange={event => setStatusFilter(event.target.value as TaskStatus | '')}>
              <option value="">Todos</option>
              {STATUS_FILTER_OPTIONS.map(status => (
                <option key={status} value={status}>{TASK_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="task-form-field">
            <label htmlFor="filter-responsible">Responsable</label>
            <select id="filter-responsible" value={responsibleFilter} onChange={event => setResponsibleFilter(event.target.value)} disabled={responsibleOptions.length === 0}>
              <option value="">Todos</option>
              {responsibleOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="task-form-field">
            <label htmlFor="filter-due-from">Vence desde</label>
            <input id="filter-due-from" type="date" value={dueFrom} onChange={event => setDueFrom(event.target.value)} />
          </div>
          <div className="task-form-field">
            <label htmlFor="filter-due-to">Vence hasta</label>
            <input id="filter-due-to" type="date" value={dueTo} onChange={event => setDueTo(event.target.value)} />
          </div>
          <button type="button" className="secondary-button" onClick={clearFilters} disabled={!hasActiveFilters}>
            Limpiar filtros
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Titulo</th>
                <th>Estado</th>
                <th>Fecha limite</th>
                {canManageTasks && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {!loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={canManageTasks ? 4 : 3} className="empty-state">Todavia no hay tareas registradas.</td>
                </tr>
              ) : null}

              {!loading && tasks.length > 0 && filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={canManageTasks ? 4 : 3} className="empty-state">Ninguna tarea coincide con los filtros aplicados.</td>
                </tr>
              ) : null}

              {filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <Link to={`/tasks/${task.id}`}>{task.title}</Link>
                  </td>
                  <td><TaskStatusBadge status={task.status} overdue={task.overdue} /></td>
                  <td>{formatDateTime(task.dueDate)}</td>
                  {canManageTasks ? (
                  <td>
                    <div className="task-actions">
                      <button
                        type="button"
                        className="task-action-button"
                        onClick={() => setTaskAction({ task, action: 'reassign' })}
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
                        onClick={() => setTaskAction({ task, action: 'cancel' })}
                        disabled={busyTaskId === task.id || task.status === 'CLOSED' || task.status === 'CANCELLED'}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      {taskAction && <TaskActionModal action={taskAction.action} taskTitle={taskAction.task.title}
        fallbackFocusRef={headingRef}
        onSubmit={value => handleTaskAction(taskAction.task.id, taskAction.action, value)}
        onClose={() => setTaskAction(null)} />}
    </section>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TaskRequestError) {
    return error.message
  }
  return 'Ocurrio un error inesperado. Intenta nuevamente.'
}

function TaskIndicatorsPanel({ indicators }: { indicators: TaskIndicators }) {
  return (
    <article className="panel" aria-label="Indicadores de seguimiento">
      <div className="panel-header">
        <div>
          <h3>Indicadores</h3>
          <p>Seguimiento en tiempo real del alcance de tus tareas.</p>
        </div>
      </div>
      <dl className="indicators-grid">
        <div className="indicator-card indicator-total">
          <dt>Tareas totales</dt>
          <dd>{indicators.totalTasks}</dd>
        </div>
        <div className="indicator-card indicator-overdue">
          <dt>Retrasadas</dt>
          <dd>{indicators.overdueCount}</dd>
        </div>
        <div className="indicator-card indicator-duesoon">
          <dt>Próximas a vencer (24 h)</dt>
          <dd>{indicators.dueSoonCount}</dd>
        </div>
        <div className="indicator-card indicator-compliance">
          <dt>Cumplimiento</dt>
          <dd>{indicators.compliancePercentage === null ? '—' : `${indicators.compliancePercentage}%`}</dd>
        </div>
        <div className="indicator-card indicator-ontime">
          <dt>Cerradas a tiempo</dt>
          <dd>{indicators.closedOnTimeCount}/{indicators.closedCount}</dd>
        </div>
      </dl>
      <div className="table-wrapper">
        <table>
          <caption>Carga de trabajo por responsable</caption>
          <thead>
            <tr>
              <th>Responsable</th>
              <th>Tareas activas</th>
            </tr>
          </thead>
          <tbody>
            {indicators.workloadByAssignee.length === 0 ? (
              <tr>
                <td colSpan={2} className="empty-state">No hay tareas activas asignadas.</td>
              </tr>
            ) : (
              indicators.workloadByAssignee.map(workload => (
                <tr key={workload.assigneeId}>
                  <td>{workload.assigneeName ?? workload.assigneeEmail ?? workload.assigneeId}</td>
                  <td>{workload.taskCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  )
}
