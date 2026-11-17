import type { TaskStatus } from '../tasks/types'

export type ReportFilters = { from: string; to: string; dateBasis: 'CREATED' | 'DUE' | 'CLOSED'; teamId: string; responsibleId: string; status: TaskStatus | '' }
export const EMPTY_FILTERS: ReportFilters = { from: '', to: '', dateBasis: 'CREATED', teamId: '', responsibleId: '', status: '' }
export type ReportMetrics = {
  total: number; active: number; pending: number; inProgress: number; completed: number; closed: number;
  cancelled: number; overdue: number; dueSoon: number; unassigned: number; evaluableClosed: number; closedOnTime: number;
  progressPercentage: number | null; compliancePercentage: number | null; averageClosureHours: number | null;
  medianClosureHours: number | null; averageActiveAgeHours: number | null; oldestActiveAgeHours: number | null; maximumOverdueHours: number | null
}
export type ReportGroup = { id: string | null; name: string; email: string | null; metrics: ReportMetrics }
export type ReportItem = {
  id: string; title: string; teamId: string | null; teamName: string | null; responsibleId: string | null;
  responsibleName: string | null; responsibleEmail: string | null; status: TaskStatus; createdAt: string | null;
  dueDate: string | null; closedAt: string | null; lastActivityAt: string | null; observations: number;
  overdueHours: number | null; ageHours: number | null; closureHours: number | null; closedOnTime: boolean | null
}
export type ExecutiveReport = {
  reportId: string; version: string; generatedAt: string; timeZone: string; scope: 'ORGANIZATION' | 'COORDINATED_TEAMS'; generatedBy: string;
  filters: { from: string | null; to: string | null; dateBasis: ReportFilters['dateBasis']; teamId: string | null; responsibleId: string | null; unassigned: boolean; status: TaskStatus | null };
  summary: ReportMetrics; quality: { missingDueDate: number; missingTeam: number; closedWithoutHistory: number; invalidClosureDates: number };
  teams: ReportGroup[]; assignees: ReportGroup[]; distribution: { status: TaskStatus; count: number }[];
  monthlyCohorts: { month: string; created: number; closed: number }[]; findings: string[]; recommendations: string[]; tasks: ReportItem[]
}
export const DATE_BASIS_LABELS = { CREATED: 'Fecha de creación', DUE: 'Fecha de vencimiento', CLOSED: 'Fecha de cierre' }
export function percent(value: number | null): string { return value === null ? 'N/D' : `${value}%` }
export function hours(value: number | null): string { return value === null ? 'N/D' : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value)} h` }
export function reportDate(value: string | null, zone: string): string {
  return value === null ? 'N/D' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(new Date(value))
}
export const REPORT_METHODOLOGY = [
  'Avance: tareas completadas o cerradas / total sin canceladas. No mide calidad de entregables.',
  'Cumplimiento a tiempo: cierres a tiempo / cierres evaluables. Un cierre evaluable tiene evento CLOSED válido y fecha límite. N/D significa sin base de cálculo, no 0%.',
  'Duración de cierre: horas calendario desde creación hasta el evento CLOSED del historial; promedio ponderado por tarea y mediana. No son horas trabajadas.',
  'El informe muestra el estado consultado actualmente, con equipo y responsable vigentes. El periodo selecciona tareas por la base de fecha indicada; no reconstruye estados ni asignaciones históricos.',
  'Las cohortes muestran creaciones y cierres conocidos de las tareas seleccionadas. No representan el flujo completo de otros periodos ni una comparación histórica del backlog.',
  'Las tareas sin responsable están incluidas. Los grupos y el detalle concilian con el total; el filtro de búsqueda en pantalla no modifica el PDF del corte generado.',
  'Retraso y antigüedad usan horas calendario al momento del corte. Las alertas de 24 h sólo aplican a tareas activas. Los indicadores no se actualizan mientras se consulta o exporta este corte.',
  'No se calculan presupuestos, rentabilidad, capacidad disponible ni desempeño cualitativo: COMPIRA no registra esos datos. Sin metas aprobadas no se asignan semáforos arbitrarios.'
]
