import { authenticatedFetch } from '../auth/authenticatedRequest'
import type {
  AddObservationPayload,
  AssignTaskPayload,
  CancelTaskPayload,
  CreateTaskPayload,
  ReassignTaskPayload,
  Task,
  TaskApiError,
  TaskHistoryEntry,
  TaskIndicators,
  TaskObservation,
  TaskReport,
  UpdateTaskStatusPayload,
} from './types'

export class TaskRequestError extends Error {
  readonly code: string

  constructor(apiError: TaskApiError) {
    super(apiError.message)
    this.name = 'TaskRequestError'
    this.code = apiError.code
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json()

  if (!response.ok) {
    throw new TaskRequestError(body as TaskApiError)
  }

  return body as T
}

const tasksUrl = '/tasks'

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const response = await authenticatedFetch(tasksUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function getManagedTasks(): Promise<Task[]> {
  const response = await authenticatedFetch(tasksUrl, { method: 'GET' })
  return handleResponse<Task[]>(response)
}

export async function getTaskIndicators(): Promise<TaskIndicators> {
  const response = await authenticatedFetch(`${tasksUrl}/indicators`, { method: 'GET' })
  return handleResponse<TaskIndicators>(response)
}

export async function getTaskReports(): Promise<TaskReport> {
  const response = await authenticatedFetch(`${tasksUrl}/reports`, { method: 'GET' })
  return handleResponse<TaskReport>(response)
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}`, { method: 'GET' })
  return handleResponse<Task>(response)
}

export async function getAssignedTasks(): Promise<Task[]> {
  const response = await authenticatedFetch(`${tasksUrl}/assigned`, { method: 'GET' })
  return handleResponse<Task[]>(response)
}

export async function assignTask(taskId: string, payload: AssignTaskPayload): Promise<Task> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/assign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function reassignTask(taskId: string, payload: ReassignTaskPayload): Promise<Task> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/reassign`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function updateTaskStatus(taskId: string, payload: UpdateTaskStatusPayload): Promise<Task> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function cancelTask(taskId: string, payload: CancelTaskPayload): Promise<Task> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function approveTask(taskId: string): Promise<Task> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/approve`, {
    method: 'POST',
  })
  return handleResponse<Task>(response)
}

export async function addObservation(taskId: string, payload: AddObservationPayload): Promise<Task> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/observations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function getObservations(taskId: string): Promise<TaskObservation[]> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/observations`, {
    method: 'GET',
  })
  return handleResponse<TaskObservation[]>(response)
}

export async function getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const response = await authenticatedFetch(`${tasksUrl}/${taskId}/history`, {
    method: 'GET',
  })
  return handleResponse<TaskHistoryEntry[]>(response)
}
