import { afterEach, expect, it, vi } from 'vitest'
import { module3Notification, module3Stream } from '../../../test/module3TestData'
import { streamNotifications } from '../notificationsApi'

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
