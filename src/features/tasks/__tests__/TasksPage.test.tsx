import { screen, waitFor } from '@testing-library/react'
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

import { approveTask, getManagedTasks } from '../tasksApi'

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
