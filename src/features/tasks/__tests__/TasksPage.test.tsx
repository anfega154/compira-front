import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { TasksPage } from '../TasksPage'
import type { Task } from '../types'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../tasksApi', () => ({
  getManagedTasks: vi.fn(),
  approveTask: vi.fn(),
  cancelTask: vi.fn(),
  reassignTask: vi.fn(),
  TaskRequestError: class TaskRequestError extends Error {
    code: string
    constructor(apiError: { code: string; message: string }) {
      super(apiError.message)
      this.code = apiError.code
    }
  },
}))

import { approveTask, getManagedTasks, reassignTask, cancelTask, TaskRequestError } from '../tasksApi'

const mockGetManaged = vi.mocked(getManagedTasks)
const mockApprove = vi.mocked(approveTask)

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Preparar informe',
    description: null,
    dueDate: null,
    status: 'COMPLETED',
    responsibleUserId: 'r1',
    createdByUserId: 'c1',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('TasksPage', () => {
  it('lists managed tasks', async () => {
    mockGetManaged.mockResolvedValueOnce([buildTask()])

    renderWithProviders(<TasksPage />)

    expect(await screen.findByText('Preparar informe')).toBeInTheDocument()
    expect(screen.getByText('Completada')).toBeInTheDocument()
  })

  it('shows empty state when there are no tasks', async () => {
    mockGetManaged.mockResolvedValueOnce([])

    renderWithProviders(<TasksPage />)

    expect(await screen.findByText(/todavia no hay tareas/i)).toBeInTheDocument()
  })

  it('enables approve only for completed tasks and approves', async () => {
    mockGetManaged.mockResolvedValue([buildTask({ status: 'COMPLETED' })])
    mockApprove.mockResolvedValueOnce(buildTask({ status: 'CLOSED' }))

    const { user } = renderWithProviders(<TasksPage />)

    const approveButton = await screen.findByRole('button', { name: /aprobar/i })
    expect(approveButton).toBeEnabled()

    await user.click(approveButton)
    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith('t1'))
  })

  it('disables approve for non-completed tasks', async () => {
    mockGetManaged.mockResolvedValueOnce([buildTask({ status: 'IN_PROGRESS' })])

    renderWithProviders(<TasksPage />)

    expect(await screen.findByRole('button', { name: /aprobar/i })).toBeDisabled()
  })
})


describe('Task action modals', () => {
  it('reassigns through an application dialog and restores focus on dismissal', async () => {
    mockGetManaged.mockResolvedValue([buildTask()])
    vi.mocked(reassignTask).mockResolvedValue(buildTask())
    const { user } = renderWithProviders(<TasksPage />)
    const trigger = await screen.findByRole('button', { name: 'Reasignar', exact: true })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Reasignar tarea' })
    expect(within(dialog).getByLabelText('Correo del nuevo responsable')).toHaveFocus()
    await user.type(within(dialog).getByLabelText('Correo del nuevo responsable'), 'nuevo@compira.co')
    await user.click(within(dialog).getByRole('button', { name: 'Reasignar tarea' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Tarea reasignada.')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(reassignTask).toHaveBeenCalledWith('t1', { newResponsibleEmail: 'nuevo@compira.co' })
    expect(trigger).toHaveFocus()
  })

  it('validates email and preserves entered data after a failed reassignment', async () => {
    mockGetManaged.mockResolvedValue([buildTask()])
    vi.mocked(reassignTask).mockRejectedValueOnce(new TaskRequestError({ code: 'TASK_001', message: 'El colaborador no pertenece al equipo.' }))
      .mockResolvedValueOnce(buildTask())
    const { user } = renderWithProviders(<TasksPage />)
    await user.click(await screen.findByRole('button', { name: 'Reasignar', exact: true }))
    const field = screen.getByLabelText('Correo del nuevo responsable')
    const submit = screen.getByRole('button', { name: 'Reasignar tarea' })
    expect(submit).toBeDisabled()
    await user.type(field, 'invalido')
    await user.click(submit)
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un correo electrónico válido.')
    expect(reassignTask).not.toHaveBeenCalled()
    await user.clear(field)
    await user.type(field, 'nuevo@compira.co')
    await user.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent('El colaborador no pertenece al equipo.')
    expect(field).toHaveValue('nuevo@compira.co')
    expect(submit).toBeEnabled()
    await user.click(submit)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not cancel a task when the confirmation is dismissed', async () => {
    mockGetManaged.mockResolvedValue([buildTask()])
    const { user } = renderWithProviders(<TasksPage />)
    await user.click(await screen.findByRole('button', { name: 'Cancelar', exact: true }))
    const dialog = screen.getByRole('dialog', { name: 'Cancelar tarea' })
    await user.click(within(dialog).getByRole('button', { name: 'Volver' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cancelTask).not.toHaveBeenCalled()
  })

  it.each(['', 'Cambio de prioridad'])('confirms cancellation with optional reason "%s"', async (reason) => {
    mockGetManaged.mockResolvedValueOnce([buildTask()]).mockResolvedValue([buildTask({ status: 'CANCELLED' })])
    vi.mocked(cancelTask).mockResolvedValue(buildTask({ status: 'CANCELLED' }))
    const { user } = renderWithProviders(<TasksPage />)
    await user.click(await screen.findByRole('button', { name: 'Cancelar', exact: true }))
    if (reason) await user.type(screen.getByLabelText('Motivo de la cancelación (opcional)'), reason)
    await user.click(screen.getByRole('button', { name: 'Cancelar tarea' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cancelTask).toHaveBeenCalledWith('t1', { reason: reason || undefined })
    expect(screen.getByRole('status')).toHaveTextContent('Tarea cancelada.')
    expect(screen.getByRole('heading', { name: 'Tareas del equipo' })).toHaveFocus()
  })
})
