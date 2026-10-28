import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Notification, module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { NotificationCenter } from '../NotificationCenter'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', fetchMock)
  persistSession(module3User(), module3Tokens)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks(); vi.useRealTimers() })

async function mount() {
  let rendered!: ReturnType<typeof renderWithProviders>
  await act(async () => { rendered = renderWithProviders(<NotificationCenter />) })
  return rendered
}
async function nextPoll() {
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
}
function openPanel() {
  fireEvent.click(screen.getByText('Notificaciones', { selector: 'summary .notification-label' }))
}

describe('NotificationCenter', () => {
  it('loads immediately with authentication and updates every 30 seconds without requesting SSE', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(Response.json([module3Notification()])))
    await mount()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Actualizadas cada 30 segundos')
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer valid-token')
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/notifications$/)
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await nextPoll()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/stream'))).toBe(false)
  })

  it('exposes an accessible unread count on small screens', async () => {
    fetchMock.mockResolvedValue(Response.json([module3Notification('ASSIGNED', '2'), module3Notification('REASSIGNED', '1')]))
    const { container } = await mount()
    expect(container.querySelector('summary')).toHaveAttribute('aria-label', 'Notificaciones, 2 sin leer')
    expect(container.querySelector('summary .notification-label')).toHaveTextContent('Notificaciones')
  })

  it('does not overlap slow requests and waits 30 seconds after completion', async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>(done => { resolve = done }))
    await mount()
    await nextPoll()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(Response.json([])) })
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resets pagination when a burst would otherwise hide a gap in history', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([module3Notification('REASSIGNED', '1')]))
      .mockResolvedValueOnce(Response.json(Array.from({ length: 50 }, (_, index) => module3Notification('ASSIGNED', String(101 - index)))))
    await mount()
    openPanel()
    await nextPoll()
    expect(screen.queryByText('Se te reasignó la tarea')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargar anteriores' })).toBeVisible()
    expect(screen.getByLabelText('50 avisos sin leer')).toHaveTextContent('50')
  })

  it('keeps older notifications and exhausted pagination across periodic snapshots', async () => {
    const page = Array.from({ length: 50 }, (_, index) => module3Notification('ASSIGNED', String(100 - index)))
    fetchMock.mockResolvedValueOnce(Response.json(page))
      .mockResolvedValueOnce(Response.json([module3Notification('REASSIGNED', '50')]))
      .mockResolvedValueOnce(Response.json(page))
    await mount()
    openPanel()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cargar anteriores' })) })
    expect(screen.getByText('Se te reasignó la tarea')).toBeVisible()
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('before=51'), expect.anything())
    await nextPoll()
    expect(screen.queryByRole('button', { name: 'Cargar anteriores' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('51 avisos sin leer')).toHaveTextContent('51')
  })

  it('updates assignment, reassignment and deadline alerts without reloading', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([module3Notification()]))
      .mockResolvedValueOnce(Response.json([module3Notification('OVERDUE', '4'), module3Notification('DUE_SOON', '3'), module3Notification('REASSIGNED', '2'), module3Notification()]))
    await mount()
    openPanel()
    expect(screen.getByText('Se te asignó la tarea')).toBeVisible()
    await nextPoll()
    expect(screen.getByText('Tarea retrasada')).toBeVisible()
    expect(screen.getByText('Próxima a vencer')).toBeVisible()
    expect(screen.getByText('Se te reasignó la tarea')).toBeVisible()
  })

  it('clears notifications when delivery is disabled', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([module3Notification()])).mockResolvedValueOnce(Response.json([]))
    await mount()
    await nextPoll()
    expect(screen.getByText('No hay notificaciones disponibles.')).toBeInTheDocument()
    expect(screen.queryByText('Informe mensual')).not.toBeInTheDocument()
  })

  it('preserves existing notifications on server failure and retries only after 30 seconds', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([module3Notification()]))
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockResolvedValueOnce(Response.json([module3Notification()]))
    await mount()
    await nextPoll()
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Reintentando en 30 segundos')
    expect(screen.getByText('Informe mensual')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999) })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Actualizadas cada 30 segundos')
  })

  it('retries a network failure without a rapid loop', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(Response.json([]))
    await mount()
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Reintentando')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await nextPoll()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('clears data on permission errors and retries only when requested', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([module3Notification()]))
      .mockResolvedValueOnce(new Response(null, { status: 403 })).mockResolvedValueOnce(Response.json([]))
    await mount()
    await nextPoll()
    expect(screen.getByText('No tienes acceso a las notificaciones.')).toBeInTheDocument()
    expect(screen.queryByText('Informe mensual')).not.toBeInTheDocument()
    await nextPoll()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reintentar', hidden: true })) })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('ends an expired session without retrying notification requests', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValue(new Response(null, { status: 204 }))
    await mount()
    await nextPoll()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/notifications'))).toHaveLength(1)
  })

  it('marks a single notification as read and decreases the unread count', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([module3Notification('ASSIGNED', '2'), module3Notification('REASSIGNED', '1')]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await mount()
    openPanel()
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Marcar leída' })[0]) })
    expect(screen.getByLabelText('1 avisos sin leer')).toHaveTextContent('1')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/notifications\/2\/read$/), expect.objectContaining({ method: 'POST' }))
  })

  it('marks all notifications as read and hides the unread badge', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([module3Notification('ASSIGNED', '2'), module3Notification('REASSIGNED', '1')]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    await mount()
    openPanel()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' })) })
    expect(screen.queryByLabelText(/avisos sin leer/)).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/notifications\/read-all$/), expect.objectContaining({ method: 'POST' }))
  })

  it('clears scheduled polling on unmount', async () => {
    fetchMock.mockResolvedValue(Response.json([]))
    const rendered = await mount()
    rendered.unmount()
    await nextPoll()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('aborts a pending request and ignores a late response after unmount', async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>(done => { resolve = done }))
    const rendered = await mount()
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    rendered.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { resolve(Response.json([module3Notification()])) })
    await nextPoll()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
