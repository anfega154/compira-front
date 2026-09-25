import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TaskRequestError,
  addObservation,
  approveTask,
  assignTask,
  cancelTask,
  createTask,
  getAssignedTasks,
  getManagedTasks,
  getObservations,
  getTask,
  getTaskHistory,
  reassignTask,
  updateTaskStatus,
} from '../tasksApi'
import { persistSession } from '../../auth/authStorage'
import type { AuthTokens, AuthUser } from '../../auth/types'

const mockFetch = vi.fn()

const user: AuthUser = {
  id: 'u1',
  cognitoSub: 'sub',
  email: 'coordinator@compira.co',
  firstName: 'Coord',
  lastName: 'Uno',
  phoneNumber: '+573001112233',
  preferredMfaChannel: 'EMAIL',
  status: 'ACTIVE',
  roles: ['COORDINATOR'],
  createdAt: '',
  updatedAt: '',
  lastLoginAt: '',
}

const tokens: AuthTokens = {
  accessToken: 'a',
  idToken: 'i',
  refreshToken: 'r',
  expiresIn: 3600,
  tokenType: 'Bearer',
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  persistSession(user, tokens)
})

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

const sampleTask = {
  id: 't1',
  title: 'Preparar informe',
  description: null,
  dueDate: null,
  status: 'PENDING',
  responsibleUserId: null,
  createdByUserId: 'u1',
  createdAt: '',
  updatedAt: '',
}

describe('tasksApi', () => {
  it('sends the actor email header from the stored user', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([sampleTask]))

    await getManagedTasks()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/tasks'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ 'X-Actor-Email': 'coordinator@compira.co' }),
      }),
    )
  })

  it('creates a task', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(sampleTask, 201))
    const result = await createTask({ title: 'Preparar informe' })
    expect(result.title).toBe('Preparar informe')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/tasks'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('lists assigned tasks', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([sampleTask]))
    const result = await getAssignedTasks()
    expect(result).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/assigned'), expect.any(Object))
  })

  it('gets a task by id', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse(sampleTask))
    await getTask('t1')
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1'), expect.any(Object))
  })

  it('assigns, reassigns, updates status, cancels and approves', async () => {
    mockFetch.mockReturnValue(jsonResponse(sampleTask))
    await assignTask('t1', { responsibleEmail: 'c@test.com' })
    await reassignTask('t1', { newResponsibleEmail: 'd@test.com' })
    await updateTaskStatus('t1', { status: 'IN_PROGRESS' })
    await cancelTask('t1', { reason: 'x' })
    await approveTask('t1')

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/assign'), expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/reassign'), expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/status'), expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/cancel'), expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/approve'), expect.any(Object))
  })

  it('adds and lists observations and history', async () => {
    mockFetch.mockReturnValue(jsonResponse([]))
    await addObservation('t1', { content: 'nota' })
    await getObservations('t1')
    await getTaskHistory('t1')
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/observations'), expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/tasks/t1/history'), expect.any(Object))
  })

  it('throws TaskRequestError on error response', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ code: 'TASK_007', message: 'Solo coordinador' }, 403))
    await expect(getManagedTasks()).rejects.toBeInstanceOf(TaskRequestError)
  })
})
