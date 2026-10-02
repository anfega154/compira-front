import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TaskRequestError, getManagedTasks } from '../tasks/tasksApi'
import { TaskStatusBadge } from '../tasks/TaskStatusBadge'
import { TASK_STATUS_LABELS, formatDateTime } from '../tasks/taskLabels'
import type { Task, TaskStatus } from '../tasks/types'
import { getUsers } from '../users/usersApi'
import { useAuth } from '../auth/useAuth'
import { canManageTaskLifecycle } from '../auth/permissions'
import { computeDashboardMetrics } from './dashboardMetrics'

type UserDisplay = { label: string; initials: string }

const STATUS_COLORS: Record<TaskStatus, string> = {
  PENDING: '#94a3b8',
  IN_PROGRESS: '#38bdf8',
  DELAYED: '#ef4444',
  COMPLETED: '#10b981',
  CLOSED: '#818cf8',
  CANCELLED: '#64748b',
}

const STATUS_FILTERS: { value: TaskStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'PENDING', label: TASK_STATUS_LABELS.PENDING },
  { value: 'IN_PROGRESS', label: TASK_STATUS_LABELS.IN_PROGRESS },
  { value: 'DELAYED', label: TASK_STATUS_LABELS.DELAYED },
  { value: 'COMPLETED', label: TASK_STATUS_LABELS.COMPLETED },
  { value: 'CLOSED', label: TASK_STATUS_LABELS.CLOSED },
  { value: 'CANCELLED', label: TASK_STATUS_LABELS.CANCELLED },
]

function fallbackInitials(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '—'
}

function makeResolver(directory: Map<string, UserDisplay>) {
  return function resolve(id: string | null): UserDisplay {
    if (!id) return { label: 'Sin responsable', initials: '—' }
    const known = directory.get(id)
    if (known) return known
    // Should not happen for an Administrator (directory covers every user).
    // Defensive fallback that never exposes the raw full identifier.
    return { label: 'Responsable', initials: fallbackInitials(id) }
  }
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreateTasks = canManageTaskLifecycle(user)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [responsibleFilter, setResponsibleFilter] = useState<string>('ALL')
  const [directory, setDirectory] = useState<Map<string, UserDisplay>>(new Map())
  // The user directory (GET /users) is Administrator-only. When it is not
  // available (e.g. Coordinator → 403) we cannot resolve responsible names, so
  // responsible-based indicators are hidden entirely rather than shown with
  // meaningless identifiers.
  const [directoryAvailable, setDirectoryAvailable] = useState(false)

  useEffect(() => {
    void loadTasks()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void getUsers(controller.signal)
      .then((users) => {
        if (controller.signal.aborted) return
        const map = new Map<string, UserDisplay>()
        for (const u of users) {
          const name = `${u.firstName} ${u.lastName}`.trim()
          map.set(u.id, {
            label: name ? `${name} · ${u.email}` : u.email,
            initials: `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase() || fallbackInitials(u.id),
          })
        }
        setDirectory(map)
        setDirectoryAvailable(true)
      })
      .catch(() => { /* directory unavailable: responsible indicators stay hidden */ })
    return () => controller.abort()
  }, [])

  const resolveUser = useMemo(() => makeResolver(directory), [directory])

  async function loadTasks() {
    setLoading(true)
    setError(null)
    try {
      setTasks(await getManagedTasks())
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  const responsibleOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const task of tasks) if (task.responsibleUserId) ids.add(task.responsibleUserId)
    return Array.from(ids)
  }, [tasks])

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (statusFilter !== 'ALL' && task.status !== statusFilter) return false
        if (responsibleFilter !== 'ALL' && task.responsibleUserId !== responsibleFilter) return false
        return true
      }),
    [tasks, statusFilter, responsibleFilter],
  )

  const metrics = useMemo(() => computeDashboardMetrics(filteredTasks), [filteredTasks])

  const hasActiveFilters = statusFilter !== 'ALL' || responsibleFilter !== 'ALL'
  const maxWorkload = Math.max(1, ...metrics.workload.map((entry) => entry.count))

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Monitoreo</p>
          <h2>Panel de monitoreo</h2>
          <p className="page-copy">
            Vista general del estado de las tareas, cumplimiento, vencimientos y carga por responsable.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="secondary-button" onClick={() => void loadTasks()} disabled={loading}>
            {loading ? 'Consultando...' : 'Recargar'}
          </button>
          {canCreateTasks && (
            <button type="button" className="primary-button" onClick={() => navigate('/tasks/create')}>
              Crear tarea
            </button>
          )}
        </div>
      </header>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}

      <div className="filter-bar">
        <label className="task-form-field" style={{ gap: 'var(--space-1)' }}>
          <span className="field-hint">Estado</span>
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
        </label>
        {directoryAvailable && (
          <label className="task-form-field" style={{ gap: 'var(--space-1)' }}>
            <span className="field-hint">Responsable</span>
            <select
              className="filter-select"
              value={responsibleFilter}
              onChange={(event) => setResponsibleFilter(event.target.value)}
              aria-label="Filtrar por responsable"
            >
              <option value="ALL">Todos los responsables</option>
              {responsibleOptions.map((id) => (
                <option key={id} value={id}>{resolveUser(id).label}</option>
              ))}
            </select>
          </label>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-clear"
            onClick={() => { setStatusFilter('ALL'); setResponsibleFilter('ALL') }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : metrics.total === 0 ? (
        <article className="panel">
          <EmptyBlock
            title={hasActiveFilters ? 'Sin resultados' : 'Todavía no hay datos'}
            message={
              hasActiveFilters
                ? 'Ningún registro coincide con los filtros aplicados. Ajusta o limpia los filtros.'
                : 'Cuando crees o gestiones tareas, aquí verás los indicadores de monitoreo.'
            }
          />
        </article>
      ) : (
        <>
          <div className="kpi-grid">
            <MetricCard label="Total de tareas" value={metrics.total} tone="info" icon="layers" />
            <MetricCard label="Pendientes" value={metrics.pending} tone="neutral" icon="clock" />
            <MetricCard label="En progreso" value={metrics.inProgress} tone="info" icon="progress" />
            <MetricCard label="Completadas" value={metrics.completed} tone="success" icon="check" />
            <MetricCard label="Vencidas" value={metrics.overdue} tone="danger" icon="alert" />
            <MetricCard label="Cumplimiento" value={`${metrics.compliance}%`} tone="success" icon="target" />
          </div>

          <div className="dashboard-grid">
            <article className="panel span-6">
              <div className="panel-header"><div><h3>Estado de las tareas</h3><p>Distribución actual por estado.</p></div></div>
              <StatusDonut distribution={metrics.statusDistribution} total={metrics.total} />
            </article>

            <article className="panel span-6">
              <div className="panel-header"><div><h3>Cumplimiento</h3><p>Tareas completadas o cerradas sobre el total vigente.</p></div></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <span className="compliance-value">{metrics.compliance}%</span>
                <div className="progress-track" role="progressbar" aria-valuenow={metrics.compliance} aria-valuemin={0} aria-valuemax={100}>
                  <div className="progress-fill" style={{ width: `${metrics.compliance}%` }} />
                </div>
                <p className="metric-foot">
                  {metrics.completed + metrics.closed} de {metrics.total - metrics.cancelled} tareas vigentes finalizadas.
                </p>
              </div>
            </article>

            {directoryAvailable && (
              <article className="panel span-6">
                <div className="panel-header"><div><h3>Carga por responsable</h3><p>Número de tareas por persona responsable.</p></div></div>
                {metrics.workload.length === 0 ? (
                  <EmptyBlock title="Sin asignaciones" message="Aún no hay tareas con responsable asignado." compact />
                ) : (
                  <ul className="bar-list">
                    {metrics.workload.slice(0, 6).map((entry) => {
                      const display = resolveUser(entry.responsibleUserId)
                      return (
                        <li className="bar-row" key={entry.responsibleUserId}>
                          <div className="bar-row-top">
                            <span className="bar-label">
                              <span className="cell-avatar">{display.initials}</span>
                              {display.label}
                            </span>
                            <span className="bar-count">{entry.count} ({entry.active} activas)</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(entry.count / maxWorkload) * 100}%` }} />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </article>
            )}

            <article className={`panel ${directoryAvailable ? 'span-6' : 'span-12'}`}>
              <div className="panel-header"><div><h3>Próximos vencimientos</h3><p>Tareas vigentes ordenadas por fecha límite.</p></div></div>
              {metrics.upcomingDeadlines.length === 0 ? (
                <EmptyBlock title="Sin vencimientos" message="No hay tareas vigentes con fecha límite." compact />
              ) : (
                <ul className="deadline-list">
                  {metrics.upcomingDeadlines.slice(0, 6).map(({ task, isOverdue }) => (
                    <li key={task.id}>
                      <span className={`deadline-marker${isOverdue ? ' is-overdue' : ''}`} aria-hidden="true" />
                      <span className="deadline-item-body">
                        <Link to={`/tasks/${task.id}`} className="deadline-title">{task.title}</Link>
                        <span className="deadline-meta">
                          {isOverdue ? 'Vencida · ' : 'Vence · '}{formatDateTime(task.dueDate)}
                        </span>
                      </span>
                      <TaskStatusBadge status={task.status} />
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="panel span-12">
              <div className="panel-header"><div><h3>Tareas vencidas</h3><p>Requieren atención inmediata.</p></div></div>
              {metrics.overdueTasks.length === 0 ? (
                <EmptyBlock title="Sin tareas vencidas" message="Todas las tareas vigentes están dentro de su fecha límite." compact />
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Título</th><th>Estado</th><th>Fecha límite</th>{directoryAvailable && <th>Responsable</th>}</tr>
                    </thead>
                    <tbody>
                      {metrics.overdueTasks.map((task) => (
                        <tr key={task.id}>
                          <td><Link to={`/tasks/${task.id}`}>{task.title}</Link></td>
                          <td><TaskStatusBadge status={task.status} /></td>
                          <td>{formatDateTime(task.dueDate)}</td>
                          {directoryAvailable && (
                            <td>
                              {task.responsibleUserId ? (
                                <span className="cell-user">
                                  <span className="cell-avatar">{resolveUser(task.responsibleUserId).initials}</span>
                                  {resolveUser(task.responsibleUserId).label}
                                </span>
                              ) : (
                                <span className="metric-foot">Sin responsable</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  )
}

type MetricCardProps = {
  label: string
  value: number | string
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  icon: keyof typeof METRIC_ICONS
}

const METRIC_ICONS = {
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  progress: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 9 9" /></>,
  check: <><path d="M20 6 9 17l-5-5" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
}

function MetricCard({ label, value, tone, icon }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon tone-${tone}`} data-icon={icon}>
          <svg viewBox="0 0 24 24" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {METRIC_ICONS[icon]}
          </svg>
        </span>
      </div>
      <strong className="metric-value">{value}</strong>
    </div>
  )
}

function StatusDonut({ distribution, total }: { distribution: { status: TaskStatus; count: number }[]; total: number }) {
  let cursor = 0
  const segments = distribution.map((entry) => {
    const start = (cursor / total) * 360
    cursor += entry.count
    const end = (cursor / total) * 360
    return `${STATUS_COLORS[entry.status]} ${start}deg ${end}deg`
  })
  const gradient = segments.length > 0 ? `conic-gradient(${segments.join(', ')})` : 'var(--surface-3)'

  return (
    <div className="donut-chart">
      <div className="donut" style={{ background: gradient }} role="img" aria-label={`Distribución de ${total} tareas por estado`}>
        <div className="donut-center">
          <strong>{total}</strong>
          <span>tareas</span>
        </div>
      </div>
      <div className="donut-legend">
        <ul>
          {distribution.map((entry) => (
            <li key={entry.status}>
              <span className="legend-dot" style={{ background: STATUS_COLORS[entry.status] }} />
              {TASK_STATUS_LABELS[entry.status]}
              <span className="legend-value">{entry.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function EmptyBlock({ title, message, compact }: { title: string; message: string; compact?: boolean }) {
  return (
    <div className="empty-block" style={compact ? { padding: 'var(--space-5) var(--space-4)' } : undefined}>
      <span className="empty-icon">
        <svg viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-3H5a2 2 0 0 0-2 3Z" />
        </svg>
      </span>
      <h4>{title}</h4>
      <p>{message}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="kpi-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="metric-card" key={index}>
            <div className="skeleton skeleton-line" style={{ width: '55%' }} />
            <div className="skeleton skeleton-line" style={{ width: '40%', height: 28 }} />
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        {['span-6', 'span-6', 'span-6', 'span-6'].map((span, index) => (
          <article className={`panel ${span}`} key={index}>
            <div className="skeleton skeleton-line" style={{ width: '35%', height: 16 }} />
            <div className="skeleton skeleton-line" style={{ width: '100%', height: 90, marginTop: 16 }} />
          </article>
        ))}
      </div>
    </>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof TaskRequestError) return error.message
  return 'Ocurrió un error inesperado. Intenta nuevamente.'
}
