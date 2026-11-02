import { useEffect, useMemo, useRef, useState } from 'react'
import { getTaskIndicators } from './tasksApi'
import { getTeams, type Team } from '../teams/teamsApi'
import type { TaskIndicators, TaskStatus } from './types'
import { TASK_STATUS_LABELS } from './taskLabels'
import { TaskStatusBadge } from './TaskStatusBadge'
import { getExecutiveReport } from '../reports/reportApi'
import { DATE_BASIS_LABELS, EMPTY_FILTERS, REPORT_METHODOLOGY, hours, percent, reportDate } from '../reports/reportTypes'
import type { ExecutiveReport, ReportFilters, ReportGroup, ReportMetrics } from '../reports/reportTypes'
import './reports.css'

const PAGE_SIZE = 25
export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({ ...EMPTY_FILTERS })
  const [generatedFilters, setGeneratedFilters] = useState<ReportFilters | null>(null)
  const [report, setReport] = useState<ExecutiveReport | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [indicators, setIndicators] = useState<TaskIndicators | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const request = useRef<AbortController | null>(null)
  const exportRequest = useRef<AbortController | null>(null)
  const dirty = generatedFilters !== null && JSON.stringify(generatedFilters) !== JSON.stringify(filters)
  const invalidRange = filters.from !== '' && filters.to !== '' && filters.from > filters.to

  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled([getTeams(controller.signal), getTaskIndicators()]).then(([teamResult, indicatorResult]) => {
      if (controller.signal.aborted) return
      if (teamResult.status === 'fulfilled') setTeams(teamResult.value)
      if (indicatorResult.status === 'fulfilled') setIndicators(indicatorResult.value)
      setOptionsError(teamResult.status === 'rejected' || indicatorResult.status === 'rejected')
    })
    void generate({ ...EMPTY_FILTERS })
    return () => { controller.abort(); request.current?.abort(); exportRequest.current?.abort() }
  }, [])

  async function generate(selected: ReportFilters) {
    request.current?.abort(); exportRequest.current?.abort()
    const controller = new AbortController(); request.current = controller
    setLoading(true); setError(null); setExportError(null); setMessage('')
    try {
      const result = await getExecutiveReport(selected, controller.signal)
      if (controller.signal.aborted) return
      setReport(result); setGeneratedFilters({ ...selected }); setPage(0); setSearch('')
      setMessage(`Informe generado con ${result.summary.total} tareas. Identificador ${result.reportId}.`)
    } catch (failure) {
      if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : 'No se pudo generar el informe.'); setReport(null); setGeneratedFilters(null) }
    } finally { if (!controller.signal.aborted) setLoading(false) }
  }

  async function exportPdf() {
    if (!report || dirty || loading || exporting) return
    const snapshot = report
    const controller = new AbortController(); exportRequest.current = controller
    const timer = setTimeout(() => controller.abort(), 30_000)
    setExporting(true); setExportError(null); setMessage('Preparando documento PDF…')
    try {
      const { createExecutivePdf, loadReportFonts, reportFilename } = await import('../reports/reportPdf')
      const fonts = await loadReportFonts(controller.signal)
      if (controller.signal.aborted) return
      await new Promise(resolve => setTimeout(resolve, 0))
      const doc = createExecutivePdf(snapshot, fonts)
      if (controller.signal.aborted) return
      doc.save(reportFilename(snapshot))
      setMessage('Documento PDF generado. Revisa las descargas del navegador.')
    } catch (failure) {
      if (exportRequest.current === controller) setExportError(controller.signal.aborted ? 'La exportación excedió el tiempo de espera. Vuelve a intentar o reduce el periodo.' : failure instanceof Error ? failure.message : 'No se pudo exportar el PDF.')
    } finally { clearTimeout(timer); if (exportRequest.current === controller) { setExporting(false); exportRequest.current = null } }
  }

  const assignees = useMemo(() => {
    const result = new Map<string, { id: string; name: string }>()
    for (const a of indicators?.assignees ?? []) result.set(a.id, { id: a.id, name: a.name || a.email || 'Responsable no disponible' })
    for (const a of report?.assignees ?? []) if (a.id) result.set(a.id, { id: a.id, name: a.name })
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [indicators, report])
  const teamOptions = useMemo(() => {
    const result = new Map(teams.map(t => [t.id, { id: t.id, name: t.name }]))
    for (const t of report?.teams ?? []) if (t.id) result.set(t.id, { id: t.id, name: t.name })
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [teams, report])
  const visibleTasks = useMemo(() => (report?.tasks ?? []).filter(t => `${t.title} ${t.id} ${t.teamName || ''} ${t.responsibleName || t.responsibleEmail || 'Sin responsable'}`.toLowerCase().includes(search.trim().toLowerCase())), [report, search])
  const pageCount = Math.max(1, Math.ceil(visibleTasks.length / PAGE_SIZE))
  function change<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) { setFilters(current => ({ ...current, [key]: value })) }

  return <section className="page executive-reports" aria-busy={loading || exporting}>
    <header className="page-header">
      <div><p className="eyebrow">Información para decisiones</p><h2>Reportes gerenciales</h2><p className="page-copy">Genera un corte verificable de tareas y expórtalo a PDF. Se respeta tu alcance de acceso.</p></div>
      <button type="button" className="secondary-button" onClick={() => void exportPdf()} disabled={!report || loading || dirty || exporting} aria-describedby="report-export-help">{exporting ? 'Preparando PDF…' : 'Exportar PDF'}</button>
    </header>
    <form className="panel report-filters" onSubmit={event => { event.preventDefault(); if (!invalidRange && !loading && !exporting) void generate({ ...filters }) }}>
      <h3>Configurar informe</h3>
      <fieldset className="report-filter-grid" disabled={loading || exporting}><legend className="sr-only">Filtros del informe</legend>
        <label>Base del periodo<select value={filters.dateBasis} onChange={e => change('dateBasis', e.target.value as ReportFilters['dateBasis'])}>{Object.entries(DATE_BASIS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Desde<input type="date" value={filters.from} min="1900-01-01" max="9998-12-31" onChange={e => change('from', e.target.value)} /></label>
        <label>Hasta<input type="date" value={filters.to} min="1900-01-01" max="9998-12-31" onChange={e => change('to', e.target.value)} /></label>
        <label>Equipo<select value={filters.teamId} onChange={e => change('teamId', e.target.value)}><option value="">Todos mis equipos autorizados</option>{teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Responsable<select value={filters.responsibleId} onChange={e => change('responsibleId', e.target.value)}><option value="">Todos, incluidos sin responsable</option><option value="UNASSIGNED">Sin responsable</option>{assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Estado<select value={filters.status} onChange={e => change('status', e.target.value as TaskStatus | '')}><option value="">Todos los estados</option>{Object.entries(TASK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </fieldset>
      <p className="field-hint">Fechas inclusivas en la zona de la organización. El periodo selecciona tareas; el informe refleja su estado actual, no un estado histórico.</p>
      {invalidRange && <p className="feedback error" role="alert">La fecha Desde no puede superar Hasta.</p>}
      {optionsError && <p className="feedback" role="status">Algunas opciones de filtro no se pudieron cargar. Puedes generar sin esos filtros o recargar la página.</p>}
      <div className="page-header-actions"><button type="submit" className="primary-button" disabled={loading || exporting || invalidRange}>{loading ? 'Generando informe…' : 'Generar informe'}</button><button type="button" className="secondary-button" disabled={loading || exporting} onClick={() => setFilters({ ...EMPTY_FILTERS })}>Limpiar filtros</button></div>
    </form>
    <p id="report-export-help" className="field-hint">El PDF contiene el corte completo generado, no sólo las filas visibles. El archivo incluye datos de responsables: compártelo únicamente con personas autorizadas.</p>
    {dirty && <p className="feedback" role="status">Hay filtros modificados. Pulsa Generar informe para aplicarlos y habilitar la exportación.</p>}
    <p className="report-live" role="status" aria-live="polite">{message}</p>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {exportError && <div className="feedback error" role="alert">{exportError}</div>}
    {report && !loading && <>
      <article className="panel report-control"><h3>Control del corte</h3><dl><div><dt>Alcance</dt><dd>{report.scope === 'ORGANIZATION' ? 'Toda la organización' : 'Tus equipos coordinados actualmente'}</dd></div><div><dt>Fecha y zona</dt><dd>{reportDate(report.generatedAt, report.timeZone)} · {report.timeZone}</dd></div><div><dt>Generado por</dt><dd>{report.generatedBy || 'Usuario autorizado'}</dd></div><div><dt>Identificador</dt><dd className="report-id">{report.reportId}</dd></div><div><dt>Periodo aplicado</dt><dd>{DATE_BASIS_LABELS[report.filters.dateBasis]}: {report.filters.from || 'Sin límite'} a {report.filters.to || 'Sin límite'}</dd></div><div><dt>Equipo aplicado</dt><dd>{report.filters.teamId ? report.teams.find(t => t.id === report.filters.teamId)?.name || 'Equipo seleccionado' : 'Todos los autorizados'}</dd></div><div><dt>Responsable aplicado</dt><dd>{report.filters.unassigned ? 'Sin responsable' : report.filters.responsibleId ? report.assignees.find(a => a.id === report.filters.responsibleId)?.name || 'Responsable seleccionado' : 'Todos'}</dd></div><div><dt>Estado aplicado</dt><dd>{report.filters.status ? TASK_STATUS_LABELS[report.filters.status] : 'Todos'}</dd></div></dl></article>
      {report.summary.total === 0 && <p className="feedback">No hay tareas para el periodo y los filtros seleccionados. Puedes exportar un informe sin datos, con su alcance y metodología.</p>}
      <ReportSummary metrics={report.summary} />
      <div className="report-two-column"><article className="panel"><h3>Resumen ejecutivo</h3><ul>{report.findings.map(text => <li key={text}>{text}</li>)}</ul></article><article className="panel"><h3>Acciones sugeridas</h3><ul>{report.recommendations.map(text => <li key={text}>{text}</li>)}</ul></article></div>
      <div className="report-two-column"><article className="panel"><h3>Distribución por estado</h3><ul className="report-distribution">{report.distribution.map(row => <li key={row.status}><span>{TASK_STATUS_LABELS[row.status]}</span><strong>{row.count}</strong><span>{report.summary.total ? `${Math.round(100 * row.count / report.summary.total)}%` : 'N/D'}</span></li>)}</ul></article><article className="panel"><h3>Calidad de datos</h3><dl className="report-quality"><dt>Sin fecha límite</dt><dd>{report.quality.missingDueDate}</dd><dt>Sin equipo</dt><dd>{report.quality.missingTeam}</dd><dt>Cierres sin historial</dt><dd>{report.quality.closedWithoutHistory}</dd><dt>Fechas de cierre inconsistentes</dt><dd>{report.quality.invalidClosureDates}</dd></dl><p className="field-hint">Los controles pueden coincidir en una tarea. Los cierres no verificables no se inventan ni se califican como tardíos.</p></article></div>
      <GroupTable title="Resultados por equipo" groups={report.teams} />
      <GroupTable title="Productividad y cumplimiento por responsable" groups={report.assignees} />
      <article className="panel"><h3>Cohortes mensuales</h3><p className="field-hint">Creaciones y cierres conocidos de las tareas seleccionadas. No es un backlog histórico ni una comparación de periodos completos.</p><div className="table-wrapper" tabIndex={0} role="region" aria-label="Cohortes mensuales"><table><thead><tr><th>Mes</th><th>Creadas</th><th>Cierres verificables</th></tr></thead><tbody>{report.monthlyCohorts.map(m => <tr key={m.month}><td>{m.month}</td><td>{m.created}</td><td>{m.closed}</td></tr>)}</tbody></table></div></article>
      <article className="panel"><h3>Inventario de tareas del corte</h3><label className="report-search">Buscar en el detalle<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Título, identificador, equipo o responsable" /></label><p className="field-hint">La búsqueda sólo afecta este listado, no los indicadores ni el PDF. {visibleTasks.length} resultados de {report.tasks.length} tareas.</p>
        <div className="table-wrapper" tabIndex={0} role="region" aria-label="Detalle de tareas del informe"><table><thead><tr><th>Tarea</th><th>Equipo</th><th>Responsable</th><th>Estado</th><th>Vencimiento</th><th>Cierre real</th><th>Retraso</th></tr></thead><tbody>{visibleTasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(t => <tr key={t.id}><td>{t.title}<small className="report-id">{t.id}</small></td><td>{t.teamName || 'Sin equipo'}</td><td>{t.responsibleName || t.responsibleEmail || 'Sin responsable'}</td><td><TaskStatusBadge status={t.status} /></td><td>{reportDate(t.dueDate, report.timeZone)}</td><td>{reportDate(t.closedAt, report.timeZone)}</td><td>{hours(t.overdueHours)}</td></tr>)}{visibleTasks.length === 0 && <tr><td colSpan={7}>No hay tareas que coincidan.</td></tr>}</tbody></table></div>
        <div className="report-pagination"><button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page + 1} de {pageCount}</span><button type="button" className="secondary-button" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}>Siguiente</button></div>
      </article>
      <article className="panel"><h3>Metodología y límites de interpretación</h3><ol>{REPORT_METHODOLOGY.map(text => <li key={text}>{text}</li>)}</ol><p className="field-hint">Fuente: API autenticada COMPIRA y PostgreSQL. Identificador de corte para trazabilidad, no firma digital. Máximo 5000 tareas filtradas; si se supera, se rechaza el informe sin truncar.</p></article>
    </>}
  </section>
}
function ReportSummary({ metrics: m }: { metrics: ReportMetrics }) {
  const entries: [string, string | number][] = [['Tareas totales', m.total], ['Activas', m.active], ['Vencidas', m.overdue], ['Vencen en 24 h', m.dueSoon], ['Sin responsable', m.unassigned], ['Pendientes de aprobación', m.completed], ['Avance de tareas', percent(m.progressPercentage)], ['Cumplimiento a tiempo', percent(m.compliancePercentage)], ['Cierre promedio', hours(m.averageClosureHours)], ['Mediana de cierre', hours(m.medianClosureHours)], ['Antigüedad activa máxima', hours(m.oldestActiveAgeHours)], ['Retraso máximo', hours(m.maximumOverdueHours)]]
  return <div className="report-kpis">{entries.map(([label, value]) => <article className="metric-card" key={label}><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong></article>)}</div>
}
function GroupTable({ title, groups }: { title: string; groups: ReportGroup[] }) {
  return <article className="panel"><h3>{title}</h3><p className="field-hint">Ordenado por tareas vencidas. Puntualidad sobre cierres evaluables; N/D no equivale a 0%. El grupo sin asignación concilia con los totales.</p><div className="table-wrapper" tabIndex={0} role="region" aria-label={title}><table><thead><tr><th>Equipo o responsable</th><th>Totales</th><th>Activas</th><th>Retrasadas</th><th>Completadas</th><th>Cerradas</th><th>A tiempo / evaluables</th><th>Cumplimiento a tiempo</th><th>Cierre promedio</th></tr></thead><tbody>{groups.map(g => <tr key={g.id || 'unassigned'}><td>{g.name}{g.email && <small>{g.email}</small>}</td><td>{g.metrics.total}</td><td>{g.metrics.active}</td><td>{g.metrics.overdue}</td><td>{g.metrics.completed}</td><td>{g.metrics.closed}</td><td>{g.metrics.closedOnTime}/{g.metrics.evaluableClosed}</td><td>{percent(g.metrics.compliancePercentage)}</td><td>{hours(g.metrics.averageClosureHours)}</td></tr>)}{groups.length === 0 && <tr><td colSpan={9}>Sin datos para este corte.</td></tr>}</tbody></table></div></article>
}
