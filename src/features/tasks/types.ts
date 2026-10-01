export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'DELAYED'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED'

export type CollaboratorTargetStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'

export type TaskHistoryEventName =
  | 'CREATED'
  | 'ASSIGNED'
  | 'STATUS_CHANGED'
  | 'OBSERVATION_ADDED'
  | 'REASSIGNED'
  | 'CANCELLED'
  | 'CLOSED'

export type Task = {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  status: TaskStatus
  overdue: boolean
  responsibleUserId: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type TaskObservation = {
  id: string
  taskId: string
  authorUserId: string
  content: string
  createdAt: string
}

export type TaskHistoryEntry = {
  id: string
  taskId: string
  event: TaskHistoryEventName
  actorUserId: string | null
  previousValue: string | null
  newValue: string | null
  detail: string | null
  createdAt: string
}

export type CreateTaskPayload = {
  teamId: string
  title: string
  description?: string
  dueDate?: string
  responsibleEmail?: string
}

export type AssignTaskPayload = {
  responsibleEmail: string
}

export type ReassignTaskPayload = {
  newResponsibleEmail: string
}

export type UpdateTaskStatusPayload = {
  status: CollaboratorTargetStatus
}

export type AddObservationPayload = {
  content: string
}

export type CancelTaskPayload = {
  reason?: string
}

export type TaskApiError = {
  code: string
  message: string
}

export type AssigneeWorkload = {
  assigneeId: string
  assigneeName: string | null
  assigneeEmail: string | null
  taskCount: number
}

export type Assignee = {
  id: string
  name: string | null
  email: string | null
}

export type TaskIndicators = {
  totalTasks: number
  overdueCount: number
  dueSoonCount: number
  closedCount: number
  closedOnTimeCount: number
  compliancePercentage: number | null
  workloadByAssignee: AssigneeWorkload[]
  assignees: Assignee[]
}

export type AssigneeReportRow = {
  assigneeId: string
  assigneeName: string | null
  assigneeEmail: string | null
  totalTasks: number
  activeTasks: number
  closedTasks: number
  closedOnTimeTasks: number
  overdueTasks: number
  compliancePercentage: number | null
  averageClosureHours: number | null
}

export type TaskReport = {
  rows: AssigneeReportRow[]
}
