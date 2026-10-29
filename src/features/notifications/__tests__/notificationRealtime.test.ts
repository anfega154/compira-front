import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { persistSession } from '../../auth/authStorage'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { startNotificationRealtime } from '../notificationRealtime'
class Socket {
  static OPEN = 1
  static instances: Socket[] = []
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()
  constructor(public url: string) { Socket.instances.push(this) }
}
const fetchMock = vi.fn()
let stop: (() => void) | undefined
const callbacks = () => ({ changed: vi.fn(), status: vi.fn(), denied: vi.fn() })
const ticket = () => Response.json({ url: 'wss://socket.example.test/qa?ticket=opaque-one-use', expiresAt: new Date(Date.now() + 3600_000).toISOString() })
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve() }
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('fetch', fetchMock); vi.stubGlobal('WebSocket', Socket)
  persistSession(module3User('COORDINATOR'), module3Tokens)
  Socket.instances = []; fetchMock.mockResolvedValue(ticket())
})
afterEach(() => { stop?.(); stop = undefined; vi.unstubAllGlobals(); vi.resetAllMocks(); vi.useRealTimers() })
describe('notification realtime transport', () => {
  it('requests a one-use ticket with bearer only over HTTPS API, not in socket URL', async () => {
    const cb = callbacks(); stop = startNotificationRealtime(cb); await flush()
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/notifications\/realtime-ticket$/)
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer valid-token')
    expect(Socket.instances[0].url).not.toContain('valid-token')
    Socket.instances[0].onopen?.()
    expect(cb.status).toHaveBeenCalledWith(true); expect(cb.changed).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(30_000); expect(fetchMock).toHaveBeenCalledOnce()
  })
  it('refreshes on invalidation, ignores unrelated and malformed messages, sends heartbeat', async () => {
    const cb = callbacks(); stop = startNotificationRealtime(cb); await flush()
    const socket = Socket.instances[0]; socket.onopen?.()
    for (const data of ['bad-json', 'null', '{"type":"unknown"}', '{"type":"notifications.changed"}']) socket.onmessage?.({ data })
    expect(cb.changed).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(60_000); expect(socket.send).toHaveBeenCalledWith('{"action":"ping"}')
    socket.onmessage?.({ data: '{"type":"pong"}' }); await vi.advanceTimersByTimeAsync(10_000)
    expect(socket.close).not.toHaveBeenCalled()
  })
  it('reconnects with a new ticket after disconnect and cleans up on logout', async () => {
    const cb = callbacks(); stop = startNotificationRealtime(cb); await flush()
    Socket.instances[0].onopen?.(); Socket.instances[0].onclose?.(); expect(cb.status).toHaveBeenLastCalledWith(false)
    await vi.advanceTimersByTimeAsync(1500); expect(fetchMock).toHaveBeenCalledTimes(2)
    stop(); await vi.advanceTimersByTimeAsync(120_000); expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(Socket.instances.at(-1)?.close).toHaveBeenCalled()
  })
  it('falls back and retries unavailable ticket endpoint', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    const cb = callbacks(); stop = startNotificationRealtime(cb); await flush()
    expect(cb.status).toHaveBeenCalledWith(false)
    await vi.advanceTimersByTimeAsync(1500); expect(Socket.instances).toHaveLength(1)
  })
  it.each([401, 403])('stops retrying when server denies access with %s', async status => {
    fetchMock.mockResolvedValue(new Response('', { status }))
    const cb = callbacks(); stop = startNotificationRealtime(cb); await flush()
    expect(cb.denied).toHaveBeenCalledWith(status)
    await vi.advanceTimersByTimeAsync(120_000); expect(fetchMock).toHaveBeenCalledOnce(); expect(Socket.instances).toHaveLength(0)
  })
  it.each([{ url: 'http://insecure.test', expiresAt: new Date(Date.now() + 60_000).toISOString() }, { url: 'wss://example.test', expiresAt: 'bad' }, null])('rejects malformed or insecure tickets', async value => {
    fetchMock.mockResolvedValue(Response.json(value))
    const cb = callbacks(); stop = startNotificationRealtime(cb); await flush()
    expect(Socket.instances).toHaveLength(0); expect(cb.status).toHaveBeenCalledWith(false)
  })
  it('closes socket that never opens and reconnects', async () => {
    stop = startNotificationRealtime(callbacks()); await flush(); await vi.advanceTimersByTimeAsync(12_000)
    expect(Socket.instances[0].close).toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('detects missing heartbeat response', async () => {
    stop = startNotificationRealtime(callbacks()); await flush(); Socket.instances[0].onopen?.(); await vi.advanceTimersByTimeAsync(72_000)
    expect(Socket.instances[0].close).toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('renews at authentication deadline', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ url: 'wss://example.test', expiresAt: new Date(Date.now() + 3000).toISOString() }))
    stop = startNotificationRealtime(callbacks()); await flush(); Socket.instances[0].onopen?.(); await vi.advanceTimersByTimeAsync(5000)
    expect(Socket.instances[0].close).toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
