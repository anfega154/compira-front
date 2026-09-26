import { screen, waitFor } from '@testing-library/react'
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

import { getAssignedTasks, updateTaskStatus } from '../tasksApi'

const mockGetAssigned = vi.mocked(getAssignedTasks)
const mockUpdateStatus = vi.mocked(updateTaskStatus)

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Preparar informe',
    description: null,
    dueDate: null,
    status: 'PENDING',
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
})
