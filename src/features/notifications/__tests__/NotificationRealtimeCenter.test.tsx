import { act, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Notification, module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { NotificationCenter } from '../NotificationCenter'
import { startNotificationRealtime } from '../notificationRealtime'
vi.mock('../../../config/env', () => ({ env: { apiUrl: 'http://localhost:8080/api/v1', notificationsRealtimeEnabled: true } }))
vi.mock('../notificationRealtime', () => ({ startNotificationRealtime: vi.fn() }))
const fetchMock = vi.fn()
const stop = vi.fn()
let callbacks: Parameters<typeof startNotificationRealtime>[0]
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('fetch', fetchMock)
  persistSession(module3User('COORDINATOR'), module3Tokens)
  vi.mocked(startNotificationRealtime).mockImplementation(cb => { callbacks = cb; return stop })
  fetchMock.mockImplementation(() => Promise.resolve(Response.json([module3Notification()])))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); vi.useRealTimers() })
async function mount() { await act(async () => { renderWithProviders(<NotificationCenter />) }) }
async function connect() { await act(async () => { callbacks.status(true); callbacks.changed() }) }
describe('notification center realtime mode', () => {
  it('stops30s polling while connected and refreshes on an event', async () => {
    await mount(); await connect()
    const count = fetchMock.mock.calls.length
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Notificaciones en tiempo real')
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000) })
    expect(fetchMock).toHaveBeenCalledTimes(count)
    await act(async () => callbacks.changed())
    expect(fetchMock).toHaveBeenCalledTimes(count + 1)
  })
  it('uses30s fallback during disconnection and stops it on reconnect', async () => {
    await mount(); await connect(); await act(async () => callbacks.status(false))
    const before = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(fetchMock).toHaveBeenCalledTimes(before + 1)
    await connect(); const after = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) }); expect(fetchMock).toHaveBeenCalledTimes(after)
    cleanup(); expect(stop).toHaveBeenCalled()
  })
  it('retries a failed HTTP refresh even when the socket remains healthy', async () => {
    await mount(); await connect()
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    await act(async () => callbacks.changed())
    const count = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(fetchMock).toHaveBeenCalledTimes(count + 1)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Notificaciones en tiempo real')
  })
  it('coalesces socket invalidations while the previous refresh is pending', async () => {
    await mount(); await connect()
    let resolve!: (response: Response) => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
    await act(async () => { callbacks.changed(); callbacks.changed(); callbacks.changed() })
    const count = fetchMock.mock.calls.length
    await act(async () => resolve(Response.json([])))
    expect(fetchMock).toHaveBeenCalledTimes(count + 1)
  })
  it('does not keep polling when the realtime ticket is forbidden', async () => {
    await mount(); await act(async () => callbacks.denied(403))
    const count = fetchMock.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(fetchMock).toHaveBeenCalledTimes(count)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('No tienes acceso')
  })
})
