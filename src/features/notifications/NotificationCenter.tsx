import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiRequestError } from '../auth/authenticatedRequest'
import { useAuth } from '../auth/useAuth'
import { getOlderNotifications, NOTIFICATION_PAGE_SIZE, streamNotifications } from './notificationsApi'
import type { TaskNotification } from './notificationsApi'
import './notifications.css'

const LABELS: Record<TaskNotification['type'], string> = {
  ASSIGNED: 'Se te asignó la tarea', REASSIGNED: 'Se te reasignó la tarea',
  DUE_SOON: 'Próxima a vencer', OVERDUE: 'Tarea retrasada',
}

export function NotificationCenter() {
  const { endSession } = useAuth()
  const [notifications, setNotifications] = useState<TaskNotification[]>([])
  const [status, setStatus] = useState<'loading' | 'connected' | 'reconnecting' | 'error'>('loading')
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
    let retryDelay = 1000
    function connect() {
      void streamNotifications(controller.signal, page => {
        retryDelay = 1000
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
          void endSession()
          return
        }
        if (error instanceof ApiRequestError && error.status === 403) {
          setNotifications([])
          setStatus('error')
          return
        }
        setStatus('reconnecting')
        timer = setTimeout(connect, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
      })
    }
    connect()
    return () => {
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

  return (
    <details className="notification-center">
      <summary>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        Notificaciones <span className="notification-count" aria-live="polite" aria-label="Avisos disponibles">{notifications.length}</span>
      </summary>
      <section className="notification-panel" aria-label="Notificaciones">
        <h2>Notificaciones</h2>
        <p className="notification-connection" role="status">
          {status === 'loading' ? 'Conectando…' : status === 'reconnecting' ? 'Conexión interrumpida. Reconectando…'
            : status === 'error' ? 'No tienes acceso a las notificaciones.' : 'Actualizadas en tiempo real'}
        </p>
        {status === 'error' && <button type="button" className="secondary-button" onClick={() => setAttempt(attempt + 1)}>Reintentar</button>}
        {status === 'connected' && notifications.length === 0 && <p>No hay notificaciones disponibles.</p>}
        <ul className="notification-list">
          {notifications.map(notification => (
            <li key={notification.id} className={`notification-${notification.type.toLowerCase()}`}>
              <strong>{LABELS[notification.type]}</strong>
              <p>{notification.taskTitle}</p>
              <time dateTime={notification.createdAt}>{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(notification.createdAt))}</time>
            </li>
          ))}
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
