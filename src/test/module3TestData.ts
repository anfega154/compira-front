import type { AuthTokens, AuthUser, UserRole } from '../features/auth/types'
import type { TaskNotification } from '../features/notifications/notificationsApi'
import type { Team } from '../features/teams/teamsApi'

export const module3Tokens: AuthTokens = { accessToken: 'valid-token', idToken: 'id-token', refreshToken: 'refresh-token', expiresIn: 3600, tokenType: 'Bearer' }
export function module3User(role: UserRole = 'COLLABORATOR'): AuthUser {
  return { id: 'user-1', cognitoSub: 'subject', email: 'user@compira.co', firstName: 'Ana', lastName: 'García', phoneNumber: '+573001112233', preferredMfaChannel: 'EMAIL', status: 'ACTIVE', roles: [role], createdAt: '', updatedAt: '', lastLoginAt: '' }
}
export function module3Notification(type: TaskNotification['type'] = 'ASSIGNED', id = '1'): TaskNotification {
  return { id, taskId: 'task-1', taskTitle: 'Informe mensual', type, createdAt: '2026-09-26T12:00:00Z', readAt: null }
}
export const module3Team: Team = { id: 'team-1', name: 'Operaciones', coordinatorUserId: 'coordinator-1', coordinatorEmail: 'coordinator@compira.co' }

export function module3Stream(signal?: AbortSignal | null) {
  let controller: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value } })
  signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true })
  return {
    response: new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }),
    send(notifications: TaskNotification[]) { controller.enqueue(new TextEncoder().encode(`event: notifications\ndata: ${JSON.stringify(notifications)}\n\n`)) },
    chunk(text: string) { controller.enqueue(new TextEncoder().encode(text)) },
    close() { controller.close() },
  }
}
