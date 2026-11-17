import { authenticatedRequest } from '../auth/authenticatedRequest'
import { TASK_STATUS_LABELS } from '../tasks/taskLabels'
import type { ExecutiveReport, ReportFilters, ReportMetrics } from './reportTypes'

export function reportQuery(filters: ReportFilters): string {
  const params = new URLSearchParams({ dateBasis: filters.dateBasis })
  for (const key of ['from', 'to', 'teamId', 'status'] as const) if (filters[key]) params.set(key, filters[key])
  if (filters.responsibleId === 'UNASSIGNED') params.set('unassigned', 'true')
  else if (filters.responsibleId) params.set('responsibleId', filters.responsibleId)
  return params.toString()
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const nullableText = (v: unknown) => v === null || typeof v === 'string'
const timestamp = (v: unknown) => v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)))
const count = (v: unknown) => finite(v) && Number.isInteger(v)
const nullableNumber = (v: unknown) => v === null || finite(v)
function metrics(v: unknown): v is ReportMetrics {
  if (!isRecord(v)) return false
  return ['total','active','pending','inProgress','completed','closed','cancelled','overdue','dueSoon','unassigned','evaluableClosed','closedOnTime'].every(k=>count(v[k]) && (v[k] as number) <= (v.total as number))
    && ['progressPercentage','compliancePercentage'].every(k=>v[k] === null || (count(v[k]) && (v[k] as number) <= 100))
    && ['averageClosureHours','medianClosureHours','averageActiveAgeHours','oldestActiveAgeHours','maximumOverdueHours'].every(k=>nullableNumber(v[k]))
}
export function isExecutiveReport(v: unknown): v is ExecutiveReport {
  if (!isRecord(v) || v.version !== '1.0' || typeof v.reportId !== 'string' || typeof v.generatedBy !== 'string' || typeof v.generatedAt !== 'string'
      || !Number.isFinite(Date.parse(v.generatedAt)) || typeof v.timeZone !== 'string' || !['ORGANIZATION','COORDINATED_TEAMS'].includes(String(v.scope))
      || !metrics(v.summary) || !isRecord(v.filters) || !['CREATED','DUE','CLOSED'].includes(String(v.filters.dateBasis)) || !isRecord(v.quality)) return false
  if (!['from','to','teamId','responsibleId','status'].every(k=>nullableText((v.filters as Record<string,unknown>)[k])) || typeof v.filters.unassigned !== 'boolean') return false
  try { new Intl.DateTimeFormat('es-CO', { timeZone: v.timeZone }).format() } catch { return false }
  if (!['missingDueDate','missingTeam','closedWithoutHistory','invalidClosureDates'].every(k=>finite((v.quality as Record<string,unknown>)[k]))) return false
  if (!['findings','recommendations'].every(k=>Array.isArray(v[k]) && (v[k] as unknown[]).every(s=>typeof s==='string'))) return false
  if (!['teams','assignees'].every(k=>Array.isArray(v[k]) && (v[k] as unknown[]).every(g=>isRecord(g) && typeof g.name==='string' && nullableText(g.id) && nullableText(g.email) && metrics(g.metrics)))) return false
  if (!Array.isArray(v.distribution) || !v.distribution.every(d=>isRecord(d) && typeof d.status === 'string' && Object.hasOwn(TASK_STATUS_LABELS, d.status) && count(d.count))) return false
  if (!Array.isArray(v.monthlyCohorts) || !v.monthlyCohorts.every(m=>isRecord(m) && typeof m.month==='string' && count(m.created) && count(m.closed))) return false
  return Array.isArray(v.tasks) && v.tasks.length <= 5000 && v.tasks.length === v.summary.total && v.tasks.every(t=>isRecord(t) && typeof t.id==='string' && typeof t.title==='string' && typeof t.status === 'string' && Object.hasOwn(TASK_STATUS_LABELS, t.status) && count(t.observations)
    && ['teamId','teamName','responsibleId','responsibleName','responsibleEmail'].every(k=>nullableText(t[k]))
    && ['createdAt','dueDate','closedAt','lastActivityAt'].every(k=>timestamp(t[k]))
    && ['overdueHours','ageHours','closureHours'].every(k=>nullableNumber(t[k]))
    && (t.closedOnTime === null || typeof t.closedOnTime === 'boolean'))
}
export async function getExecutiveReport(filters: ReportFilters, signal: AbortSignal): Promise<ExecutiveReport> {
  const timeout = new AbortController()
  const abort=()=>timeout.abort(signal.reason)
  if (signal.aborted) abort()
  else signal.addEventListener('abort',abort,{once:true})
  const timer=setTimeout(()=>timeout.abort(new DOMException('La generación superó el tiempo de espera. Reduzca el periodo y vuelva a intentar.','TimeoutError')),35_000)
  try {
    const response=await authenticatedRequest(`/tasks/reports/executive?${reportQuery(filters)}`,{method:'GET',signal:timeout.signal,cache:'no-store'})
    const result: unknown=await response.json()
    if (!isExecutiveReport(result)) throw new Error('El informe recibido no tiene un formato válido. Genérelo nuevamente; no se exportaron datos parciales.')
    return result
  } finally { clearTimeout(timer);signal.removeEventListener('abort',abort) }
}
