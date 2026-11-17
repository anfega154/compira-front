import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiRequestError } from '../auth/authenticatedRequest'
import { useAuth } from '../auth/useAuth'
import {
  getOlderNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_PAGE_SIZE,
  getLatestNotifications,
  NOTIFICATION_POLL_INTERVAL_MS,
} from './notificationsApi'
import type { TaskNotification } from './notificationsApi'
import './notifications.css'
import { env } from '../../config/env'
import { startNotificationRealtime } from './notificationRealtime'

const LABELS: Record<TaskNotification['type'], string> = {
  ASSIGNED: 'Se te asignó la tarea', REASSIGNED: 'Se te reasignó la tarea',
  DUE_SOON: 'Próxima a vencer', OVERDUE: 'Tarea retrasada',
  TASK_COMPLETED: 'Tarea completada por el colaborador', OBSERVATION_ADDED: 'Nueva observación en la tarea',
}

const ICONS: Record<TaskNotification['type'], ReactNode> = {
  ASSIGNED: <path d="M20 6 9 17l-5-5" />,
  TASK_COMPLETED: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  OBSERVATION_ADDED: <path d="M4 4h16v12H8l-4 4V4Z" />,
  REASSIGNED: <><path d="M3 2v6h6" /><path d="M3 13a9 9 0 1 0 3-7L3 8" /></>,
  DUE_SOON: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  OVERDUE: <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" /></>,
}

export function NotificationCenter() {
  const { endSession } = useAuth()
  const [notifications, setNotifications] = useState<TaskNotification[]>([])
  const [status, setStatus] = useState<'loading' | 'connected' | 'reconnecting' | 'error'>('loading')
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const refreshLatest = useRef<() => void>(() => {})
  const [attempt, setAttempt] = useState(0)
  const [hasOlder, setHasOlder] = useState(false)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [pageError, setPageError] = useState('')
  const hasLoadedOlder = useRef(false)
  const latestPage = useRef<TaskNotification[]>([])
  const pagination = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let connected = false
    let loading = false
    let pending = false
    let forbidden = false
    let refreshFailed = false
    function refresh() {
      if (controller.signal.aborted || forbidden) return
      if (loading) { pending = true; return }
      clearTimeout(timer)
      loading = true
      void getLatestNotifications(controller.signal).then(page => {
        if (controller.signal.aborted || forbidden) return
        refreshFailed = false
        setStatus('connected')
        const hasGap = latestPage.current.length > 0 && page.length === NOTIFICATION_PAGE_SIZE
          && !page.some(notification => latestPage.current.some(previous => previous.id === notification.id))
        latestPage.current = page
        setNotifications(previous => page.length === 0 || hasGap ? page : [
          ...page,
          ...previous.filter(notification => BigInt(notification.id) < BigInt(page[page.length - 1].id)),
        ])
        if (page.length === 0 || hasGap) {
          pagination.current?.abort()
          setIsLoadingOlder(false)
          hasLoadedOlder.current = false
        }
        if (!hasLoadedOlder.current) setHasOlder(page.length === NOTIFICATION_PAGE_SIZE)
      }).catch(error => {
        if (controller.signal.aborted) return
        if (error instanceof ApiRequestError && error.status === 401) {
          forbidden = true
          void endSession()
          return
        }
        if (error instanceof ApiRequestError && error.status === 403) {
          forbidden = true
          setNotifications([])
          setStatus('error')
          return
        }
        refreshFailed = true
        setStatus('reconnecting')
      }).finally(() => {
        loading = false
        if (controller.signal.aborted || forbidden) return
        if (pending) { pending = false; refresh() }
        else if (!connected || refreshFailed) timer = setTimeout(refresh, NOTIFICATION_POLL_INTERVAL_MS)
      })
    }
    refreshLatest.current = refresh
    refresh()
    const stopRealtime = env.notificationsRealtimeEnabled ? startNotificationRealtime({
      changed: refresh,
      status: active => {
        connected = active
        setRealtimeConnected(active)
        clearTimeout(timer)
        if (!active && !loading && !forbidden) timer = setTimeout(refresh, NOTIFICATION_POLL_INTERVAL_MS)
      },
      denied: code => {
        if (code === 401) void endSession()
        else { forbidden = true; setNotifications([]); setStatus('error'); clearTimeout(timer) }
      },
    }) : () => {}
    return () => {
      stopRealtime()
      refreshLatest.current = () => {}
      controller.abort()
      pagination.current?.abort()
      clearTimeout(timer)
    }
  }, [attempt, endSession])

  async function handleLoadOlder() {
    const last = notifications.at(-1)
    if (!last || pagination.current && !pagination.current.signal.aborted && isLoadingOlder) return
    const controller = new AbortController()
    pagination.current = controller
    setIsLoadingOlder(true)
    setPageError('')
    try {
      const page = await getOlderNotifications(last.id, controller.signal)
      if (controller.signal.aborted) return
      setNotifications(previous => [...previous, ...page.filter(notification => !previous.some(existing => existing.id === notification.id))])
      hasLoadedOlder.current = true
      setHasOlder(page.length === NOTIFICATION_PAGE_SIZE)
    } catch (error) {
      if (!controller.signal.aborted) setPageError(error instanceof Error ? error.message : 'No se pudieron cargar los avisos anteriores.')
    } finally {
      if (!controller.signal.aborted) setIsLoadingOlder(false)
    }
  }

  async function handleMarkRead(id: string) {
    setNotifications(previous => previous.map(notification =>
      notification.id === id && notification.readAt === null
        ? { ...notification, readAt: new Date().toISOString() }
        : notification))
    try {
      await markNotificationRead(id)
    } catch {
      refreshLatest.current()
    }
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString()
    setNotifications(previous => previous.map(notification =>
      notification.readAt === null ? { ...notification, readAt: now } : notification))
    try {
      await markAllNotificationsRead()
    } catch {
      refreshLatest.current()
    }
  }

  const unreadCount = notifications.filter(notification => notification.readAt === null).length

  return (
    <details className="notification-center">
      <summary aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span className="notification-label">Notificaciones</span>
        {unreadCount > 0 && (
          <span className="notification-count" aria-live="polite" aria-label={`${unreadCount} avisos sin leer`}>{unreadCount}</span>
        )}
      </summary>
      <section className="notification-panel" aria-label="Notificaciones">
        <div className="notification-panel-header">
          <h2>Notificaciones</h2>
          {unreadCount > 0 && (
            <button type="button" className="notification-mark-all" onClick={() => void handleMarkAllRead()}>
              Marcar todas como leídas
            </button>
          )}
        </div>
        <p className="notification-connection" role="status">
          {status === 'loading' ? 'Consultando avisos…' : status === 'reconnecting' ? 'No se pudieron actualizar los avisos. Reintentando en 30 segundos…'
            : status === 'error' ? 'No tienes acceso a las notificaciones.' : realtimeConnected ? 'Notificaciones en tiempo real' : 'Actualizadas cada 30 segundos'}
        </p>
        {status === 'error' && <button type="button" className="secondary-button" onClick={() => setAttempt(attempt + 1)}>Reintentar</button>}
        {status === 'connected' && notifications.length === 0 && <p>No hay notificaciones disponibles.</p>}
        <ul className="notification-list">
          {notifications.map(notification => {
            const isUnread = notification.readAt === null
            return (
              <li key={notification.id} className={`notification-${notification.type.toLowerCase()}${isUnread ? ' notification-unread' : ' notification-read'}`}>
                <span className="notification-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {ICONS[notification.type]}
                  </svg>
                </span>
                <div className="notification-body">
                  <strong>{LABELS[notification.type]}</strong>
                  <p>
                    <Link to={`/tasks/${notification.taskId}`} onClick={() => void handleMarkRead(notification.id)}>
                      {notification.taskTitle}
                    </Link>
                  </p>
                  <div className="notification-meta">
                    <time dateTime={notification.createdAt}>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt))}</time>
                    {isUnread && (
                      <button type="button" className="notification-mark-read" onClick={() => void handleMarkRead(notification.id)}>
                        Marcar leída
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {pageError && <p role="alert">{pageError}</p>}
        {hasOlder && <button className="secondary-button" type="button" disabled={isLoadingOlder} onClick={() => void handleLoadOlder()}>
          {isLoadingOlder ? 'Cargando…' : 'Cargar anteriores'}
        </button>}
        {status === 'error' && <Link to="/tasks/assigned">Volver a mis tareas</Link>}
      </section>
    </details>
  )
}
