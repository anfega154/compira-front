import { env } from '../../config/env'
import { getStoredUser } from '../auth/authStorage'
import type {
  AddObservationPayload,
  AssignTaskPayload,
  CancelTaskPayload,
  CreateTaskPayload,
  ReassignTaskPayload,
  Task,
  TaskApiError,
  TaskHistoryEntry,
  TaskObservation,
  UpdateTaskStatusPayload,
} from './types'

const ACTOR_EMAIL_HEADER = 'X-Actor-Email'

export class TaskRequestError extends Error {
  readonly code: string

  constructor(apiError: TaskApiError) {
    super(apiError.message)
    this.name = 'TaskRequestError'
    this.code = apiError.code
  }
}

function actorHeaders(): HeadersInit {
  const user = getStoredUser()
  return {
    'Content-Type': 'application/json',
    [ACTOR_EMAIL_HEADER]: user?.email ?? '',
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

const tasksUrl = `${env.apiUrl}/tasks`

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const response = await fetch(tasksUrl, {
    method: 'POST',
    headers: actorHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function getManagedTasks(): Promise<Task[]> {
  const response = await fetch(tasksUrl, { method: 'GET', headers: actorHeaders() })
  return handleResponse<Task[]>(response)
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${taskId}`, { method: 'GET', headers: actorHeaders() })
  return handleResponse<Task>(response)
}

export async function getAssignedTasks(): Promise<Task[]> {
  const response = await fetch(`${tasksUrl}/assigned`, { method: 'GET', headers: actorHeaders() })
  return handleResponse<Task[]>(response)
}

export async function assignTask(taskId: string, payload: AssignTaskPayload): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${taskId}/assign`, {
    method: 'POST',
    headers: actorHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function reassignTask(taskId: string, payload: ReassignTaskPayload): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${taskId}/reassign`, {
    method: 'POST',
    headers: actorHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function updateTaskStatus(taskId: string, payload: UpdateTaskStatusPayload): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${taskId}/status`, {
    method: 'POST',
    headers: actorHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function cancelTask(taskId: string, payload: CancelTaskPayload): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${taskId}/cancel`, {
    method: 'POST',
    headers: actorHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function approveTask(taskId: string): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${taskId}/approve`, {
    method: 'POST',
    headers: actorHeaders(),
  })
  return handleResponse<Task>(response)
}

export async function addObservation(taskId: string, payload: AddObservationPayload): Promise<Task> {
  const response = await fetch(`${tasksUrl}/${taskId}/observations`, {
    method: 'POST',
    headers: actorHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse<Task>(response)
}

export async function getObservations(taskId: string): Promise<TaskObservation[]> {
  const response = await fetch(`${tasksUrl}/${taskId}/observations`, {
    method: 'GET',
    headers: actorHeaders(),
  })
  return handleResponse<TaskObservation[]>(response)
}

export async function getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const response = await fetch(`${tasksUrl}/${taskId}/history`, {
    method: 'GET',
    headers: actorHeaders(),
  })
  return handleResponse<TaskHistoryEntry[]>(response)
}
