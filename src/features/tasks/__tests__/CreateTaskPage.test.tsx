import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { CreateTaskPage } from '../CreateTaskPage'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

vi.mock('../tasksApi', () => ({
  createTask: vi.fn(),
  TaskRequestError: class TaskRequestError extends Error {
    code: string
    constructor(apiError: { code: string; message: string }) {
      super(apiError.message)
      this.code = apiError.code
    }
  },
}))

import { createTask } from '../tasksApi'

const mockCreateTask = vi.mocked(createTask)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('CreateTaskPage', () => {
  it('renders the create task form', () => {
    renderWithProviders(<CreateTaskPage />)
    expect(screen.getByLabelText('Titulo')).toBeInTheDocument()
    expect(screen.getByLabelText('Descripcion')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeInTheDocument()
  })

  it('disables submit when title is empty', () => {
    renderWithProviders(<CreateTaskPage />)
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
  })

  it('creates a task and shows success message', async () => {
    mockCreateTask.mockResolvedValueOnce({
      id: 't1',
      title: 'Preparar informe',
      description: null,
      dueDate: null,
      status: 'PENDING',
      responsibleUserId: null,
      createdByUserId: 'c1',
      createdAt: '',
      updatedAt: '',
    })

    const { user } = renderWithProviders(<CreateTaskPage />)

    await user.type(screen.getByLabelText('Titulo'), 'Preparar informe')
    await user.click(screen.getByRole('button', { name: /crear tarea/i }))

    expect(mockCreateTask).toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent(/creada correctamente/i)
  })

  it('shows an error message when creation fails', async () => {
    const { TaskRequestError } = await import('../tasksApi')
    mockCreateTask.mockRejectedValueOnce(new TaskRequestError({ code: 'TASK_007', message: 'Solo un coordinador' }))

    const { user } = renderWithProviders(<CreateTaskPage />)

    await user.type(screen.getByLabelText('Titulo'), 'Preparar informe')
    await user.click(screen.getByRole('button', { name: /crear tarea/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Solo un coordinador')
  })
})
