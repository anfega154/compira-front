import type { TaskHistoryEventName, TaskStatus } from './types'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  DELAYED: 'Retrasada',
  COMPLETED: 'Completada',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
}

export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  PENDING: 'status-pending',
  IN_PROGRESS: 'status-progress',
  DELAYED: 'status-delayed',
  COMPLETED: 'status-completed',
  CLOSED: 'status-closed',
  CANCELLED: 'status-cancelled',
}

export const TASK_EVENT_LABELS: Record<TaskHistoryEventName, string> = {
  CREATED: 'Tarea creada',
  ASSIGNED: 'Responsable asignado',
  STATUS_CHANGED: 'Cambio de estado',
  OBSERVATION_ADDED: 'Observacion registrada',
  REASSIGNED: 'Tarea reasignada',
  CANCELLED: 'Tarea cancelada',
  CLOSED: 'Tarea cerrada',
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'Sin fecha'
  return new Date(value).toLocaleString()
}
