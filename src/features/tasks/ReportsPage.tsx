import { useEffect, useMemo, useState } from 'react'
import { TaskRequestError, getTaskReports } from './tasksApi'
import type { AssigneeReportRow, TaskReport } from './types'

function formatHours(value: number | null): string {
  if (value === null) return '—'
  return `${value} h`
}

function formatPercentage(value: number | null): string {
  if (value === null) return '—'
  return `${value}%`
}

function assigneeLabel(row: AssigneeReportRow): string {
  return row.assigneeName ?? row.assigneeEmail ?? row.assigneeId
}

function initials(row: AssigneeReportRow): string {
  const base = row.assigneeName ?? row.assigneeEmail ?? row.assigneeId
  const parts = base.trim().split(/\s+/)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2)
  return letters.toUpperCase()
}

function complianceTone(value: number | null): 'info' | 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === null) return 'neutral'
  if (value >= 80) return 'success'
  if (value >= 50) return 'warning'
  return 'danger'
}

type SortKey = keyof Pick<
  AssigneeReportRow,
  | 'totalTasks'
  | 'activeTasks'
  | 'closedTasks'
  | 'closedOnTimeTasks'
  | 'overdueTasks'
  | 'compliancePercentage'
  | 'averageClosureHours'
>

const COLUMNS: { key: SortKey; label: string; format: (row: AssigneeReportRow) => string }[] = [
  { key: 'totalTasks', label: 'Totales', format: (r) => String(r.totalTasks) },
  { key: 'activeTasks', label: 'Activas', format: (r) => String(r.activeTasks) },
  { key: 'closedTasks', label: 'Cerradas', format: (r) => String(r.closedTasks) },
  { key: 'closedOnTimeTasks', label: 'Cerradas a tiempo', format: (r) => String(r.closedOnTimeTasks) },
  { key: 'overdueTasks', label: 'Retrasadas', format: (r) => String(r.overdueTasks) },
  { key: 'compliancePercentage', label: 'Cumplimiento', format: (r) => formatPercentage(r.compliancePercentage) },
  { key: 'averageClosureHours', label: 'Tiempo prom. de cierre', format: (r) => formatHours(r.averageClosureHours) },
]

export function ReportsPage() {
  const [report, setReport] = useState<TaskReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('compliancePercentage')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    const controller = new AbortController()
    void loadReport(controller)
    return () => controller.abort()
  }, [])

  async function loadReport(controller?: AbortController) {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getTaskReports()
      if (!controller?.signal.aborted) setReport(data)
    } catch (requestError) {
      if (!controller?.signal.aborted) {
        setError(requestError instanceof TaskRequestError ? requestError.message : 'No se pudieron cargar los reportes.')
      }
    } finally {
      if (!controller?.signal.aborted) setIsLoading(false)
    }
  }

  const rows = report?.rows ?? []

  // KPIs agregados calculados a partir de los datos reales por responsable.
  const summary = useMemo(() => {
    const totalTasks = rows.reduce((acc, r) => acc + r.totalTasks, 0)
    const closedTasks = rows.reduce((acc, r) => acc + r.closedTasks, 0)
    const closedOnTime = rows.reduce((acc, r) => acc + r.closedOnTimeTasks, 0)
    const overdue = rows.reduce((acc, r) => acc + r.overdueTasks, 0)
    const active = rows.reduce((acc, r) => acc + r.activeTasks, 0)
    const compliance = closedTasks > 0 ? Math.round((closedOnTime / closedTasks) * 100) : null
    return { totalTasks, closedTasks, closedOnTime, overdue, active, compliance, people: rows.length }
  }, [rows])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = term
      ? rows.filter((r) => assigneeLabel(r).toLowerCase().includes(term))
      : rows
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const an = av === null ? -Infinity : av
      const bn = bv === null ? -Infinity : bv
      if (an === bn) return assigneeLabel(a).localeCompare(assigneeLabel(b))
      return an < bn ? -dir : dir
    })
  }, [rows, search, sortKey, sortDir])

  // Ranking de cumplimiento (barras). Normaliza por el máximo visible.
  const ranking = useMemo(() => {
    return [...rows]
      .filter((r) => r.compliancePercentage !== null)
      .sort((a, b) => (b.compliancePercentage ?? 0) - (a.compliancePercentage ?? 0))
      .slice(0, 6)
  }, [rows])

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h2>Reportes</h2>
          <p className="page-copy">Productividad, cumplimiento y tiempos de cierre por responsable, bajo demanda.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void loadReport()} disabled={isLoading}>
          {isLoading ? 'Consultando…' : 'Actualizar'}
        </button>
      </header>

      {error ? <div className="feedback error" role="alert">{error}</div> : null}

      {isLoading ? (
        <article className="panel">
          <div className="kpi-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="metric-card" key={i}>
                <div className="skeleton skeleton-line" style={{ width: '55%' }} />
                <div className="skeleton skeleton-line" style={{ width: '40%', height: 28, marginTop: 10 }} />
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {!isLoading && rows.length === 0 && !error ? (
        <article className="panel">
          <p className="empty-state">No hay datos suficientes para generar reportes.</p>
        </article>
      ) : null}

      {!isLoading && rows.length > 0 ? (
        <>
          {/* Resumen KPI interactivo */}
          <div className="kpi-grid">
            <MetricCard label="Tareas totales" value={summary.totalTasks} tone="info" icon="layers" />
            <MetricCard label="Activas" value={summary.active} tone="neutral" icon="progress" />
            <MetricCard
              label="Cumplimiento global"
              value={summary.compliance === null ? '—' : `${summary.compliance}%`}
              tone={complianceTone(summary.compliance)}
              icon="target"
            />
            <MetricCard label="Retrasadas" value={summary.overdue} tone="danger" icon="alert" />
          </div>

          <div className="dashboard-grid">
            {/* Ranking de cumplimiento por responsable */}
            <article className="panel span-6">
              <div className="panel-header">
                <div>
                  <h3>Ranking de cumplimiento</h3>
                  <p>Mejores responsables por porcentaje de cierre a tiempo.</p>
                </div>
              </div>
              {ranking.length === 0 ? (
                <p className="empty-state">Aún no hay cumplimiento calculable.</p>
              ) : (
                <ul className="bar-list">
                  {ranking.map((row) => {
                    const pct = row.compliancePercentage ?? 0
                    return (
                      <li className="bar-row" key={row.assigneeId}>
                        <div className="bar-row-top">
                          <span className="bar-label">
                            <span className="cell-avatar">{initials(row)}</span>
                            {assigneeLabel(row)}
                          </span>
                          <span className="bar-count">{pct}%</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className={`bar-fill tone-${complianceTone(row.compliancePercentage)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>

            {/* Carga activa por responsable */}
            <article className="panel span-6">
              <div className="panel-header">
                <div>
                  <h3>Carga activa</h3>
                  <p>Tareas activas por responsable.</p>
                </div>
              </div>
              {rows.every((r) => r.activeTasks === 0) ? (
                <p className="empty-state">No hay tareas activas asignadas.</p>
              ) : (
                <ul className="bar-list">
                  {[...rows]
                    .sort((a, b) => b.activeTasks - a.activeTasks)
                    .slice(0, 6)
                    .map((row) => {
                      const max = Math.max(1, ...rows.map((r) => r.activeTasks))
                      return (
                        <li className="bar-row" key={row.assigneeId}>
                          <div className="bar-row-top">
                            <span className="bar-label">
                              <span className="cell-avatar">{initials(row)}</span>
                              {assigneeLabel(row)}
                            </span>
                            <span className="bar-count">{row.activeTasks} activas</span>
                          </div>
                          <div className="bar-track">
                            <div className="bar-fill tone-info" style={{ width: `${(row.activeTasks / max) * 100}%` }} />
                          </div>
                        </li>
                      )
                    })}
                </ul>
              )}
            </article>
          </div>

          {/* Tabla detallada: ordenable + buscable */}
          <article className="panel">
            <div className="panel-header">
              <div>
                <h3>Productividad y cumplimiento</h3>
                <p>Resumen por responsable dentro de tu alcance. Haz clic en una columna para ordenar.</p>
              </div>
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
                  placeholder="Buscar por responsable"
                  aria-label="Buscar responsable en el reporte"
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Responsable</th>
                    {COLUMNS.map((col) => {
                      const isActive = sortKey === col.key
                      return (
                        <th key={col.key} scope="col" aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <button type="button" className="sortable-header" onClick={() => toggleSort(col.key)}>
                            {col.label}
                            <span className="sort-indicator" aria-hidden="true">
                              {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1} className="empty-state">
                        Ningún responsable coincide con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => (
                      <tr key={row.assigneeId}>
                        <td>
                          <span className="cell-user">
                            <span className="cell-avatar" aria-hidden="true">{initials(row)}</span>
                            {assigneeLabel(row)}
                          </span>
                        </td>
                        <td>{row.totalTasks}</td>
                        <td>{row.activeTasks}</td>
                        <td>{row.closedTasks}</td>
                        <td>{row.closedOnTimeTasks}</td>
                        <td>{row.overdueTasks}</td>
                        <td>
                          <span className={`task-status-badge ${complianceBadge(row.compliancePercentage)}`}>
                            {formatPercentage(row.compliancePercentage)}
                          </span>
                        </td>
                        <td>{formatHours(row.averageClosureHours)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </section>
  )
}

function complianceBadge(value: number | null): string {
  if (value === null) return 'status-pending'
  if (value >= 80) return 'status-completed'
  if (value >= 50) return 'status-progress'
  return 'status-delayed'
}

type MetricCardProps = {
  label: string
  value: number | string
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  icon: keyof typeof METRIC_ICONS
}

const METRIC_ICONS = {
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></>,
  progress: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 9 9" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  alert: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /></>,
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
