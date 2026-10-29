import { authenticatedRequest, ApiRequestError } from '../auth/authenticatedRequest'

type Callbacks = {
  changed: () => void
  status: (connected: boolean) => void
  denied: (status: number) => void
}

/** WebSocket is only an invalidation hint. Durable notices always come from the authenticated API. */
export function startNotificationRealtime(callbacks: Callbacks): () => void {
  const controller = new AbortController()
  let socket: WebSocket | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let renewal: ReturnType<typeof setTimeout> | undefined
  let pongDeadline: ReturnType<typeof setTimeout> | undefined
  let failures = 0

  function clearConnectionTimers() {
    clearTimeout(deadline)
    clearTimeout(renewal)
    clearTimeout(pongDeadline)
    clearInterval(heartbeat)
  }
  function reconnect() {
    clearConnectionTimers()
    if (controller.signal.aborted || retry) return
    callbacks.status(false)
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)) + Math.floor(Math.random() * 250)
    retry = setTimeout(() => { retry = undefined; void connect() }, delay)
  }
  async function connect() {
    try {
      const response = await authenticatedRequest('/notifications/realtime-ticket', {
        method: 'POST', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      })
      const ticket: unknown = await response.json()
      if (controller.signal.aborted) return
      if (!ticket || typeof ticket !== 'object' || !('url' in ticket) || typeof ticket.url !== 'string'
        || !('expiresAt' in ticket) || typeof ticket.expiresAt !== 'string') throw new Error('Invalid realtime ticket')
      const endpoint = new URL(ticket.url)
      const loopback = ['localhost', '127.0.0.1'].includes(location.hostname) && ['localhost', '127.0.0.1'].includes(endpoint.hostname)
      if (endpoint.protocol !== 'wss:' && !(loopback && endpoint.protocol === 'ws:')) throw new Error('Insecure realtime endpoint')
      const expiresIn = Date.parse(ticket.expiresAt) - Date.now()
      if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 7_200_000) throw new Error('Invalid realtime expiry')
      if (socket) {
        socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
        socket.close()
      }
      const active = new WebSocket(endpoint.href)
      socket = active
      deadline = setTimeout(() => { active.close(); reconnect() }, 10_000)
      active.onopen = () => {
        if (controller.signal.aborted || socket !== active) { active.close(); return }
        clearTimeout(deadline)
        failures = 0
        callbacks.status(true)
        callbacks.changed() // Close the fetch/connect race and recover notices received offline.
        heartbeat = setInterval(() => {
          if (active.readyState !== WebSocket.OPEN) return
          active.send(JSON.stringify({ action: 'ping' }))
          pongDeadline = setTimeout(() => { active.close(); reconnect() }, 10_000)
        }, 60_000)
        renewal = setTimeout(() => { active.close(); reconnect() }, expiresIn)
      }
      active.onmessage = event => {
        if (controller.signal.aborted || socket !== active) return
        try {
          const message: unknown = JSON.parse(String(event.data))
          if (!message || typeof message !== 'object' || !('type' in message)) return
          if (message.type === 'pong') clearTimeout(pongDeadline)
          if (message.type === 'notifications.changed') callbacks.changed()
        } catch { /* Ignore malformed or unrelated messages; never render remote HTML. */ }
      }
      active.onerror = () => { if (socket === active) { active.close(); reconnect() } }
      active.onclose = () => { if (socket === active) reconnect() }
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiRequestError && [401, 403].includes(error.status)) {
        callbacks.denied(error.status)
        return
      }
      reconnect()
    }
  }
  void connect()
  return () => {
    controller.abort()
    clearTimeout(retry)
    clearConnectionTimers()
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      socket.close()
    }
  }
}
