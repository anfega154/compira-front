import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Notification, module3Stream, module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { NotificationCenter } from '../NotificationCenter'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); persistSession(module3User(), module3Tokens) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); vi.useRealTimers() })

describe('NotificationCenter', () => {
  it('resets pagination when a burst would otherwise hide a gap in notification history', async () => {
    const stream = module3Stream()
    fetchMock.mockResolvedValue(stream.response)
    const { user } = renderWithProviders(<NotificationCenter />)
    await user.click(screen.getByText('Notificaciones', { selector: 'summary' }))
    await act(async () => stream.send([module3Notification('REASSIGNED', '1')]))
    await act(async () => stream.send(Array.from({ length: 50 }, (_, index) => module3Notification('ASSIGNED', String(101 - index)))))
    expect(screen.queryByText('Se te reasignó la tarea')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cargar anteriores' })).toBeVisible()
    expect(screen.getByLabelText('50 avisos sin leer')).toHaveTextContent('50')
  })

  it('loads older persisted notifications once and keeps pagination exhausted across live snapshots', async () => {
    const stream = module3Stream()
    const page = Array.from({ length: 50 }, (_, index) => module3Notification('ASSIGNED', String(100 - index)))
    fetchMock.mockResolvedValueOnce(stream.response).mockResolvedValueOnce(new Response(JSON.stringify([module3Notification('REASSIGNED', '50')])))
    const { user } = renderWithProviders(<NotificationCenter />)
    await user.click(screen.getByText('Notificaciones', { selector: 'summary' }))
    await act(async () => stream.send(page))
    await user.click(await screen.findByRole('button', { name: 'Cargar anteriores' }))
    expect(await screen.findByText('Se te reasignó la tarea')).toBeVisible()
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('before=51'), expect.anything())
    await act(async () => stream.send(page))
    expect(screen.queryByRole('button', { name: 'Cargar anteriores' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('51 avisos sin leer')).toHaveTextContent('51')
  })

  it('receives persisted and live assignment, reassignment and deadline alerts without reloading', async () => {
    const stream = module3Stream()
    fetchMock.mockResolvedValue(stream.response)
    const { user } = renderWithProviders(<NotificationCenter />)
    await user.click(screen.getByText('Notificaciones', { selector: 'summary' }))
    expect(screen.getByRole('status')).toHaveTextContent('Conectando')
    await act(async () => stream.send([module3Notification()]))
    expect(await screen.findByText('Se te asignó la tarea')).toBeVisible()
    await act(async () => stream.send([module3Notification('OVERDUE', '4'), module3Notification('DUE_SOON', '3'), module3Notification('REASSIGNED', '2'), module3Notification()]))
    expect(await screen.findByText('Tarea retrasada')).toBeVisible()
    expect(screen.getByText('Próxima a vencer')).toBeVisible()
    expect(screen.getByText('Se te reasignó la tarea')).toBeVisible()
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer valid-token')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/notifications/stream'), expect.objectContaining({ headers: expect.any(Headers) }))
  })

  it('clears visible notifications when the global switch disables delivery', async () => {
    const stream = module3Stream()
    fetchMock.mockResolvedValue(stream.response)
    renderWithProviders(<NotificationCenter />)
    await act(async () => stream.send([module3Notification()]))
    await screen.findByText('Se te asignó la tarea')
    await act(async () => stream.send([]))
    expect(await screen.findByText('No hay notificaciones disponibles.')).toBeInTheDocument()
    expect(screen.queryByText('Informe mensual')).not.toBeInTheDocument()
  })

  it('announces interruption and reconnects after a closed stream', async () => {
    const stream = module3Stream()
    const resumed = module3Stream()
    fetchMock.mockResolvedValueOnce(stream.response).mockResolvedValueOnce(resumed.response)
    renderWithProviders(<NotificationCenter />)
    await act(async () => stream.close())
    expect(await screen.findByRole('status')).toHaveTextContent('Reconectando')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2500 })
    await act(async () => resumed.send([module3Notification()]))
    expect(await screen.findByRole('status')).toHaveTextContent('Actualizadas')
  })

  it('clears data and does not retry permission errors', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }))
    renderWithProviders(<NotificationCenter />)
    expect(await screen.findByText('No tienes acceso a las notificaciones.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar', hidden: true })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks a single notification as read and decreases the unread count', async () => {
    const stream = module3Stream()
    fetchMock.mockResolvedValue(stream.response)
    const { user } = renderWithProviders(<NotificationCenter />)
    await user.click(screen.getByText('Notificaciones', { selector: 'summary' }))
    await act(async () => stream.send([module3Notification('ASSIGNED', '2'), module3Notification('REASSIGNED', '1')]))
    expect(screen.getByLabelText('2 avisos sin leer')).toHaveTextContent('2')

    await user.click(screen.getAllByRole('button', { name: 'Marcar leída' })[0])

    expect(screen.getByLabelText('1 avisos sin leer')).toHaveTextContent('1')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/notifications\/2\/read$/), expect.objectContaining({ method: 'POST' }))
  })

  it('marks all notifications as read and hides the unread badge', async () => {
    const stream = module3Stream()
    fetchMock.mockResolvedValue(stream.response)
    const { user } = renderWithProviders(<NotificationCenter />)
    await user.click(screen.getByText('Notificaciones', { selector: 'summary' }))
    await act(async () => stream.send([module3Notification('ASSIGNED', '2'), module3Notification('REASSIGNED', '1')]))

    await user.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }))

    expect(screen.queryByLabelText(/avisos sin leer/)).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/notifications\/read-all$/), expect.objectContaining({ method: 'POST' }))
  })

  it('aborts the connection on unmount', async () => {
    let signal: AbortSignal | null | undefined
    fetchMock.mockImplementation((_url, options: RequestInit) => { signal = options.signal; return Promise.resolve(module3Stream(signal).response) })
    const rendered = renderWithProviders(<NotificationCenter />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    rendered.unmount()
    expect(signal?.aborted).toBe(true)
  })
})
