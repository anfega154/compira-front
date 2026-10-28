import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { persistSession } from '../../auth/authStorage'
import { module3Notification, module3Tokens, module3User } from '../../../test/module3TestData'
import { getLatestNotifications, getOlderNotifications, markAllNotificationsRead, markNotificationRead } from '../notificationsApi'

beforeEach(() => { persistSession(module3User(), module3Tokens) })
afterEach(() => vi.unstubAllGlobals())

it.each([{ id: 'not-a-number' }, { createdAt: 'invalid-date' }])('rejects unsafe notification values %j', async invalid => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([{ ...module3Notification(), ...invalid }])))
  await expect(getLatestNotifications(new AbortController().signal)).rejects.toThrow('Respuesta de notificaciones inválida.')
})

it('fetches a finite authenticated JSON snapshot without caching', async () => {
  const notification = module3Notification()
  const fetchMock = vi.fn().mockResolvedValue(Response.json([notification]))
  vi.stubGlobal('fetch', fetchMock)
  await expect(getLatestNotifications(new AbortController().signal)).resolves.toEqual([notification])
  expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/notifications$/), expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }))
  const headers = new Headers(fetchMock.mock.calls[0][1].headers)
  expect(headers.get('Authorization')).toBe('Bearer valid-token')
  expect(headers.get('Accept')).toBe('application/json')
})

it('forwards cancellation to the HTTP request', async () => {
  const controller = new AbortController()
  const fetchMock = vi.fn().mockResolvedValue(Response.json([]))
  vi.stubGlobal('fetch', fetchMock)
  await getLatestNotifications(controller.signal)
  controller.abort()
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
})

it('bounds a hanging HTTP request with a 15-second timeout signal', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([])))
  await getLatestNotifications(new AbortController().signal)
  expect(timeout).toHaveBeenCalledWith(15_000)
  timeout.mockRestore()
})

it.each([null, { invalid: true }])('rejects a non-array snapshot %j', async payload => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(payload)))
  await expect(getLatestNotifications(new AbortController().signal)).rejects.toThrow('Respuesta de notificaciones inválida.')
})

it('keeps older-page cursor pagination', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json([module3Notification()]))
  vi.stubGlobal('fetch', fetchMock)
  await expect(getOlderNotifications('51', new AbortController().signal)).resolves.toHaveLength(1)
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/notifications?before=51'), expect.anything())
})

it('marks a single notification as read', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(markNotificationRead('7')).resolves.toBeUndefined()
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/notifications/7/read'), expect.objectContaining({ method: 'POST' }))
})

it('marks all notifications as read', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(markAllNotificationsRead()).resolves.toBeUndefined()
  expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/notifications/read-all'), expect.objectContaining({ method: 'POST' }))
})

it('accepts readAt and defaults missing readAt to null', async () => {
  const { readAt: _readAt, ...legacy } = module3Notification()
  const read = { ...module3Notification('REASSIGNED', '2'), readAt: '2026-09-26T13:00:00Z' }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json([legacy, read])))
  await expect(getLatestNotifications(new AbortController().signal)).resolves.toEqual([{ ...legacy, readAt: null }, read])
})
