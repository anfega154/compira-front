import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { TaskDetailPage } from '../TaskDetailPage'
import { addObservation, getTask, getTaskHistory, getObservations, TaskRequestError } from '../tasksApi'

vi.mock('react-router-dom', async () => ({ ...await vi.importActual('react-router-dom'), useParams: () => ({ taskId: 't1' }) }))
vi.mock('../tasksApi', async () => ({ ...await vi.importActual('../tasksApi'), addObservation: vi.fn(), getTask: vi.fn(), getTaskHistory: vi.fn(), getObservations: vi.fn() }))
const observation = { id: 'o1', taskId: 't1', authorUserId: 'user-1', authorName: 'Ana García', authorEmail: 'ana@example.test', content: 'Revisado por coordinación', createdAt: '2026-10-16T10:00:00Z' }
beforeEach(() => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  vi.mocked(getTask).mockResolvedValue({ id: 't1', title: 'Informe', description: null, dueDate: null, status: 'PENDING', overdue: false, responsibleUserId: 'other', createdByUserId: 'user-1', createdAt: '', updatedAt: '', teamId: 'team-1', teamName: 'Operaciones' })
  vi.mocked(getObservations).mockResolvedValue([{ ...observation, id: 'old', content: 'Observación anterior' }])
  vi.mocked(getTaskHistory).mockResolvedValue([])
  vi.mocked(addObservation).mockResolvedValue(observation)
})
afterEach(() => vi.resetAllMocks())

it.each(['COORDINATOR', 'ADMINISTRATOR'] as const)('lets %s read and add an observation and displays the saved response', async role => {
  persistSession(module3User(role), module3Tokens)
  const { user } = renderWithProviders(<TaskDetailPage />)
  expect(await screen.findByText('Observación anterior')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Agregar observación' }))
  await user.type(screen.getByLabelText('Observación'), observation.content)
  await user.click(screen.getByRole('button', { name: 'Guardar observación' }))
  expect(await screen.findByText(observation.content)).toBeVisible()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(addObservation).toHaveBeenCalledWith('t1', { content: observation.content })
})

it('retains the draft and does not display a failed observation as saved', async () => {
  vi.mocked(addObservation).mockRejectedValue(new TaskRequestError({ code: 'TEAM_001', message: 'No tienes acceso a este equipo' }))
  const { user } = renderWithProviders(<TaskDetailPage />)
  await user.click(await screen.findByRole('button', { name: 'Agregar observación' }))
  const input = screen.getByLabelText('Observación')
  await user.type(input, 'Mi borrador')
  await user.click(screen.getByRole('button', { name: 'Guardar observación' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No tienes acceso a este equipo')
  expect(input).toHaveValue('Mi borrador')
  expect(screen.queryByText(observation.content)).not.toBeInTheDocument()
})

it('does not offer observations to an unrelated collaborator', async () => {
  persistSession(module3User('COLLABORATOR'), module3Tokens)
  renderWithProviders(<TaskDetailPage />)
  await screen.findByText('Observación anterior')
  expect(screen.queryByRole('button', { name: 'Agregar observación' })).not.toBeInTheDocument()
})

it('does not encourage duplicate submission if only history refresh fails', async () => {
  vi.mocked(getTaskHistory).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('network'))
  const { user } = renderWithProviders(<TaskDetailPage />)
  await user.click(await screen.findByRole('button', { name: 'Agregar observación' }))
  await user.type(screen.getByLabelText('Observación'), observation.content)
  await user.click(screen.getByRole('button', { name: 'Guardar observación' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('La observación se guardó')
  expect(screen.getByText(observation.content)).toBeVisible()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(addObservation).toHaveBeenCalledTimes(1)
})

it('keeps collaborator detail and observations available without requesting manager-only history', async () => {
  persistSession(module3User('COLLABORATOR'), module3Tokens)
  vi.mocked(getTaskHistory).mockRejectedValue(new Error('forbidden'))
  renderWithProviders(<TaskDetailPage />)
  expect(await screen.findByText('Observación anterior')).toBeVisible()
  expect(getTaskHistory).not.toHaveBeenCalled()
})


it('shows who performed each historical action and distinguishes automatic actions', async () => {
  vi.mocked(getTaskHistory).mockResolvedValue([
    { id: 'h1', taskId: 't1', event: 'STATUS_CHANGED', actorUserId: 'worker-1', actorName: 'Luis Pérez', actorEmail: 'luis@example.test', previousValue: 'IN_PROGRESS', newValue: 'COMPLETED', detail: null, createdAt: '' },
    { id: 'h2', taskId: 't1', event: 'STATUS_CHANGED', actorUserId: null, previousValue: 'PENDING', newValue: 'DELAYED', detail: null, createdAt: '' },
    { id: 'h3', taskId: 't1', event: 'CREATED', actorUserId: 'legacy-user', previousValue: null, newValue: null, detail: null, createdAt: '' },
  ])
  renderWithProviders(<TaskDetailPage />)
  expect(await screen.findByText('Por: Luis Pérez (luis@example.test)')).toBeVisible()
  expect(screen.getByText('Por: Sistema (automático)')).toBeVisible()
  expect(screen.getByText('Por: Usuario no disponible')).toBeVisible()
  expect(screen.getByText('Por: Ana García (ana@example.test)')).toBeVisible()
})

it('shows the author immediately after saving an observation', async () => {
  const { user } = renderWithProviders(<TaskDetailPage />)
  await user.click(await screen.findByRole('button', { name: 'Agregar observación' }))
  await user.type(screen.getByLabelText('Observación'), observation.content)
  await user.click(screen.getByRole('button', { name: 'Guardar observación' }))
  await screen.findByText(observation.content)
  expect(screen.getAllByText('Por: Ana García (ana@example.test)')).toHaveLength(2)
})
