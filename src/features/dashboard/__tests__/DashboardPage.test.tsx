import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { getManagedTasks, TaskRequestError } from '../../tasks/tasksApi'
import { getUsers } from '../../users/usersApi'
import type { Task } from '../../tasks/types'
import { DashboardPage } from '../DashboardPage'

vi.mock('../../tasks/tasksApi', async (original) => ({ ...await original<typeof import('../../tasks/tasksApi')>(), getManagedTasks: vi.fn() }))
vi.mock('../../users/usersApi', () => ({ getUsers: vi.fn() }))

function task(overrides: Partial<Task> = {}): Task {
  return { id: 'task-1', title: 'Entrega pendiente', description: null, status: 'PENDING', dueDate: '2020-01-01T12:00:00Z', responsibleUserId: 'member-1', createdByUserId: 'coordinator', createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-01T00:00:00Z', teamId: 'team-1', teamName: 'Operaciones', ...overrides }
}

beforeEach(() => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  vi.mocked(getManagedTasks).mockResolvedValue([task(), task({ id: 'task-2', title: 'Entrega completada', status: 'COMPLETED' })])
  vi.mocked(getUsers).mockRejectedValue(new Error('Directorio exclusivo del administrador'))
})
afterEach(() => vi.resetAllMocks())

describe('DashboardPage coordinator task follow-up', () => {
  it('shows deadlines and completion metrics even when coordinator cannot read the user directory', async () => {
    renderWithProviders(<DashboardPage />)
    expect((await screen.findAllByRole('link', { name: 'Entrega pendiente' }))[0]).toHaveAttribute('href', '/tasks/task-1')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.queryByRole('combobox', { name: 'Filtrar por responsable' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Carga por responsable' })).not.toBeInTheDocument()
  })

  it('filters completed tasks and restores the active task list', async () => {
    const { user } = renderWithProviders(<DashboardPage />)
    await screen.findByRole('progressbar')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por estado' }), 'COMPLETED')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('Sin vencimientos')).toBeVisible()
    expect(screen.getByText('Sin tareas vencidas')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('resolves administrator identities and filters workload without exposing raw identifiers', async () => {
    persistSession(module3User('ADMINISTRATOR'), module3Tokens)
    vi.mocked(getUsers).mockResolvedValue([{ id: 'member-1', firstName: 'Ana', lastName: 'García', email: 'ana@example.test', status: 'ACTIVE', roles: ['COLLABORATOR'], teamId: 'team-1', teamName: 'Operaciones', phoneNumber: '+573001112233', createdAt: '', lastLoginAt: null }])
    vi.mocked(getManagedTasks).mockResolvedValue([task(), task({ id: 'task-2', responsibleUserId: null, title: 'Sin asignar' })])
    const { user } = renderWithProviders(<DashboardPage />)
    const select = await screen.findByRole('combobox', { name: 'Filtrar por responsable' })
    await screen.findByRole('progressbar')
    expect(screen.getAllByText('Ana García · ana@example.test').length).toBeGreaterThan(0)
    expect(screen.getByText('Sin responsable')).toBeVisible()
    await user.selectOptions(select, 'member-1')
    expect(screen.queryByRole('link', { name: 'Sin asignar' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por estado' }), 'CLOSED')
    expect(screen.getByText('Sin resultados')).toBeVisible()
  })

  it('shows an empty task list', async () => {
    vi.mocked(getManagedTasks).mockResolvedValue([])
    renderWithProviders(<DashboardPage />)
    expect(await screen.findByText('Todavía no hay datos')).toBeVisible()
  })

  it('allows reloading after a task request error', async () => {
    vi.mocked(getManagedTasks).mockRejectedValueOnce(new TaskRequestError({ code: 'TASK_503', message: 'No se pudo cargar' }))
    const { user } = renderWithProviders(<DashboardPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar')
    await user.click(screen.getByRole('button', { name: 'Recargar' }))
    await screen.findByRole('progressbar')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getManagedTasks).toHaveBeenCalledTimes(2)
  })
})
