import { beforeEach } from 'vitest'
import { persistSession } from '../../auth/authStorage'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { afterEach, expect, it, vi } from 'vitest'
import { module3Notification, module3Stream } from '../../../test/module3TestData'
import { markAllNotificationsRead, markNotificationRead, streamNotifications } from '../notificationsApi'

afterEach(() => vi.unstubAllGlobals())
it.each([{ id: 'not-a-number' }, { createdAt: 'invalid-date' }])('rejects unsafe notification values %j', async invalid => {
  const stream = module3Stream()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response))
  const listener = vi.fn()
  const connection = streamNotifications(new AbortController().signal, listener)
  stream.chunk(`data: ${JSON.stringify([{ ...module3Notification(), ...invalid }])}\n\n`)
  await expect(connection).rejects.toThrow('Respuesta de notificaciones inválida.')
  expect(listener).not.toHaveBeenCalled()
})

it('decodes fragmented CRLF SSE messages and rejects invalid payloads', async () => {
  const stream = module3Stream()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response))
  const listener = vi.fn()
  const connection = streamNotifications(new AbortController().signal, listener)
  stream.chunk(`event: notifications\r`)
  stream.chunk(`\ndata: ${JSON.stringify([module3Notification()])}\r`)
  stream.chunk('\n\r\n')
  stream.chunk('data: {"invalid":true}\n\n')
  await expect(connection).rejects.toThrow('Respuesta de notificaciones inválida.')
  expect(listener).toHaveBeenCalledWith([module3Notification()])
})

beforeEach(() => { persistSession(module3User(), module3Tokens) })

it('marks a single notification as read via POST /notifications/{id}/read', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(markNotificationRead('7')).resolves.toBeUndefined()
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/notifications/7/read'),
    expect.objectContaining({ method: 'POST' }),
  )
})

it('marks all notifications as read via POST /notifications/read-all', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(markAllNotificationsRead()).resolves.toBeUndefined()
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining('/notifications/read-all'),
    expect.objectContaining({ method: 'POST' }),
  )
})

it('still accepts snapshots that include a readAt field', async () => {
  const stream = module3Stream()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response))
  const listener = vi.fn()
  const connection = streamNotifications(new AbortController().signal, listener)
  stream.chunk(`data: ${JSON.stringify([{ ...module3Notification(), readAt: '2026-09-26T13:00:00Z' }])}\n\n`)
  stream.chunk(`data: ${JSON.stringify([{ ...module3Notification('REASSIGNED', '2'), readAt: null }])}\n\n`)
  stream.close()
  await expect(connection).rejects.toThrow('Se interrumpió la conexión de notificaciones.')
  expect(listener).toHaveBeenCalledTimes(2)
})
