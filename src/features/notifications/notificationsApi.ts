import { authenticatedRequest } from '../auth/authenticatedRequest'

export type TaskNotification = {
  id: string
  taskId: string
  taskTitle: string
  type: 'ASSIGNED' | 'REASSIGNED' | 'DUE_SOON' | 'OVERDUE'
  createdAt: string
  /** ISO timestamp when the recipient read the notice, or null when unread. */
  readAt: string | null
}

const BASE = '/notifications'
export const NOTIFICATION_PAGE_SIZE = 50

function isNotification(value: unknown): value is TaskNotification {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string' && /^[1-9]\d*$/.test(value.id)
    && 'taskId' in value && typeof value.taskId === 'string'
    && 'taskTitle' in value && typeof value.taskTitle === 'string'
    && 'createdAt' in value && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && 'type' in value && ['ASSIGNED', 'REASSIGNED', 'DUE_SOON', 'OVERDUE'].some(type => type === value.type)
    && (!('readAt' in value) || value.readAt === null || typeof value.readAt === 'string')
}

function parseNotifications(value: unknown): TaskNotification[] {
  if (!Array.isArray(value) || !value.every(isNotification)) throw new Error('Respuesta de notificaciones inválida.')
  return value.map(notification => ({ ...notification, readAt: notification.readAt ?? null }))
}

/** Marks a single notification as read. Backend: POST /notifications/{id}/read (204, idempotent). */
export async function markNotificationRead(id: string): Promise<void> {
  await authenticatedRequest(`${BASE}/${encodeURIComponent(id)}/read`, { method: 'POST' })
}

/** Marks every notification of the current user as read. Backend: POST /notifications/read-all (204, idempotent). */
export async function markAllNotificationsRead(): Promise<void> {
  await authenticatedRequest(`${BASE}/read-all`, { method: 'POST' })
}

export async function getOlderNotifications(before: string, signal: AbortSignal): Promise<TaskNotification[]> {
  const response = await authenticatedRequest(`${BASE}?before=${encodeURIComponent(before)}`, { signal })
  return parseNotifications(await response.json())
}

export const NOTIFICATION_POLL_INTERVAL_MS = 30_000
const NOTIFICATION_REQUEST_TIMEOUT_MS = 15_000

export async function getLatestNotifications(signal: AbortSignal): Promise<TaskNotification[]> {
  const response = await authenticatedRequest(BASE, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(NOTIFICATION_REQUEST_TIMEOUT_MS)]),
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  return parseNotifications(await response.json())
}
