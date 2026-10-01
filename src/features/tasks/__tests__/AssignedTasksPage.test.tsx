import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { AssignedTasksPage } from '../AssignedTasksPage'
import type { Task } from '../types'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual }
})

vi.mock('../tasksApi', () => ({
  getAssignedTasks: vi.fn(),
  updateTaskStatus: vi.fn(),
  addObservation: vi.fn(),
  TaskRequestError: class TaskRequestError extends Error {
    code: string
    constructor(apiError: { code: string; message: string }) {
      super(apiError.message)
      this.code = apiError.code
    }
  },
}))

import { getAssignedTasks, updateTaskStatus, addObservation } from '../tasksApi'

const mockGetAssigned = vi.mocked(getAssignedTasks)
const mockUpdateStatus = vi.mocked(updateTaskStatus)

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Preparar informe',
    description: null,
    dueDate: null,
    status: 'PENDING',
    overdue: false,
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

describe('AssignedTasksPage', () => {
  it('lists assigned tasks', async () => {
    mockGetAssigned.mockResolvedValueOnce([buildTask()])

    renderWithProviders(<AssignedTasksPage />)

    expect(await screen.findByText('Preparar informe')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('shows empty state when no tasks are assigned', async () => {
    mockGetAssigned.mockResolvedValueOnce([])

    renderWithProviders(<AssignedTasksPage />)

    expect(await screen.findByText(/no tienes tareas asignadas/i)).toBeInTheDocument()
  })

  it('advances the status of a pending task', async () => {
    mockGetAssigned.mockResolvedValue([buildTask({ status: 'PENDING' })])
    mockUpdateStatus.mockResolvedValueOnce(buildTask({ status: 'IN_PROGRESS' }))

    const { user } = renderWithProviders(<AssignedTasksPage />)

    const startButton = await screen.findByRole('button', { name: /iniciar/i })
    await user.click(startButton)

    await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledWith('t1', { status: 'IN_PROGRESS' }))
  })

  it('marks an overdue in-progress task without offering a redundant resume action', async () => {
    mockGetAssigned.mockResolvedValue([buildTask({ status: 'IN_PROGRESS', overdue: true, dueDate: '2026-09-01T00:00:00Z' })])

    renderWithProviders(<AssignedTasksPage />)

    const row = await screen.findByRole('row', { name: /Preparar informe/i })
    expect(within(row).getByText('En progreso')).toBeInTheDocument()
    expect(within(row).getByText('Retrasada')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Retomar' })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Completar' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Volver a pendiente' })).toBeInTheDocument()
  })

  it('shows the overdue marker on a pending task that passed its due date', async () => {
    mockGetAssigned.mockResolvedValue([buildTask({ status: 'PENDING', overdue: true, dueDate: '2026-09-01T00:00:00Z' })])

    renderWithProviders(<AssignedTasksPage />)

    const row = await screen.findByRole('row', { name: /Preparar informe/i })
    expect(within(row).getByText('Pendiente')).toBeInTheDocument()
    expect(within(row).getByText('Retrasada')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Iniciar' })).toBeInTheDocument()
  })
})


it('records a trimmed multiline observation using an application modal', async () => {
  mockGetAssigned.mockResolvedValue([buildTask()])
  vi.mocked(addObservation).mockResolvedValue(buildTask())
  const { user } = renderWithProviders(<AssignedTasksPage />)
  await user.click(await screen.findByRole('button', { name: 'Observacion' }))
  expect(screen.getByRole('dialog', { name: 'Agregar observación' })).toBeVisible()
  const field = screen.getByLabelText('Observación')
  expect(field).toHaveAttribute('maxlength', '2000')
  const submit = screen.getByRole('button', { name: 'Guardar observación' })
  await user.type(field, '   ')
  expect(submit).toBeDisabled()
  await user.type(field, 'Primera línea{Enter}Segunda línea  ')
  await user.click(submit)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(addObservation).toHaveBeenCalledWith('t1', { content: 'Primera línea\nSegunda línea' })
  expect(screen.getByRole('status')).toHaveTextContent('Observacion registrada.')
})


it('blocks duplicate submission and dismissal while saving an observation', async () => {
  mockGetAssigned.mockResolvedValue([buildTask()])
  let completeSave: (task: Task) => void = () => {}
  vi.mocked(addObservation).mockReturnValue(new Promise(resolve => { completeSave = resolve }))
  const { user } = renderWithProviders(<AssignedTasksPage />)
  await user.click(await screen.findByRole('button', { name: 'Observacion' }))
  await user.type(screen.getByLabelText('Observación'), 'Avance registrado')
  await user.dblClick(screen.getByRole('button', { name: 'Guardar observación' }))
  expect(addObservation).toHaveBeenCalledTimes(1)
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('status')).toHaveTextContent('Guardando cambios…')
  expect(within(dialog).getByRole('button', { name: 'Cerrar modal' })).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled()
  fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
  expect(dialog).toBeVisible()
  await act(async () => completeSave(buildTask()))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('closes with Escape without saving, restores focus and resets the next form', async () => {
  mockGetAssigned.mockResolvedValue([buildTask()])
  const { user } = renderWithProviders(<AssignedTasksPage />)
  const trigger = await screen.findByRole('button', { name: 'Observacion' })
  await user.click(trigger)
  await user.type(screen.getByLabelText('Observación'), 'Borrador')
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(addObservation).not.toHaveBeenCalled()
  expect(trigger).toHaveFocus()
  expect(document.body.style.overflow).not.toBe('hidden')
  await user.click(trigger)
  expect(screen.getByLabelText('Observación')).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'Cerrar modal' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
