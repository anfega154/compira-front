import { useEffect, useState } from 'react'
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

export function ReportsPage() {
  const [report, setReport] = useState<TaskReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

      <article className="panel">
        <div className="panel-header">
          <div>
            <h3>Productividad y cumplimiento</h3>
            <p>Resumen por responsable dentro de tu alcance.</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Responsable</th>
                <th>Totales</th>
                <th>Activas</th>
                <th>Cerradas</th>
                <th>Cerradas a tiempo</th>
                <th>Retrasadas</th>
                <th>Cumplimiento</th>
                <th>Tiempo prom. de cierre</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="empty-state" role="status">Cargando reportes…</td>
                </tr>
              ) : null}

              {!isLoading && rows.length === 0 && !error ? (
                <tr>
                  <td colSpan={8} className="empty-state">No hay datos suficientes para generar reportes.</td>
                </tr>
              ) : null}

              {!isLoading && rows.map(row => (
                <tr key={row.assigneeId}>
                  <td>{assigneeLabel(row)}</td>
                  <td>{row.totalTasks}</td>
                  <td>{row.activeTasks}</td>
                  <td>{row.closedTasks}</td>
                  <td>{row.closedOnTimeTasks}</td>
                  <td>{row.overdueTasks}</td>
                  <td>{formatPercentage(row.compliancePercentage)}</td>
                  <td>{formatHours(row.averageClosureHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}
