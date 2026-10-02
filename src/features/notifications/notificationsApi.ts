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

export async function streamNotifications(signal: AbortSignal, onSnapshot: (notifications: TaskNotification[]) => void): Promise<void> {
  const response = await authenticatedRequest(`${BASE}/stream`, { signal, headers: { Accept: 'text/event-stream' } })
  if (!response.body) throw new Error('No se pudo abrir la conexión de notificaciones.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n')
      if (buffer.length > 1_000_000) throw new Error('Respuesta de notificaciones inválida.')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const event = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const payload = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (payload && !signal.aborted) onSnapshot(parseNotifications(JSON.parse(payload)))
        boundary = buffer.indexOf('\n\n')
      }
    }
    if (!signal.aborted) throw new Error('Se interrumpió la conexión de notificaciones.')
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
