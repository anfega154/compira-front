import type { Task, TaskStatus } from '../tasks/types'

/**
 * Dashboard metrics derived entirely from the task list already available
 * through the existing `GET /tasks` endpoint. No new backend contracts, no
 * invented business rules — only aggregation of data the client already has.
 */

export type StatusDistribution = {
  status: TaskStatus
  count: number
}

export type WorkloadEntry = {
  responsibleUserId: string
  count: number
  active: number
}

export type DeadlineEntry = {
  task: Task
  isOverdue: boolean
}

export type DashboardMetrics = {
  total: number
  pending: number
  inProgress: number
  completed: number
  delayed: number
  closed: number
  cancelled: number
  /** Tasks whose dueDate is in the past and are not completed/closed/cancelled. */
  overdue: number
  /** Completed + closed over the total of non-cancelled tasks, as a percentage. */
  compliance: number
  statusDistribution: StatusDistribution[]
  workload: WorkloadEntry[]
  upcomingDeadlines: DeadlineEntry[]
  overdueTasks: Task[]
}

const ACTIVE_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DELAYED']
const DONE_STATUSES: TaskStatus[] = ['COMPLETED', 'CLOSED']

function isOverdue(task: Task, now: number): boolean {
  if (!task.dueDate) return false
  if (DONE_STATUSES.includes(task.status) || task.status === 'CANCELLED') return false
  const due = Date.parse(task.dueDate)
  return Number.isFinite(due) && due < now
}

export function computeDashboardMetrics(tasks: Task[], now: number = Date.now()): DashboardMetrics {
  const counts: Record<TaskStatus, number> = {
    PENDING: 0,
    IN_PROGRESS: 0,
    DELAYED: 0,
    COMPLETED: 0,
    CLOSED: 0,
    CANCELLED: 0,
  }

  const workloadMap = new Map<string, { count: number; active: number }>()
  const overdueTasks: Task[] = []

  for (const task of tasks) {
    counts[task.status] += 1

    const responsible = task.responsibleUserId
    if (responsible) {
      const entry = workloadMap.get(responsible) ?? { count: 0, active: 0 }
      entry.count += 1
      if (ACTIVE_STATUSES.includes(task.status)) entry.active += 1
      workloadMap.set(responsible, entry)
    }

    if (isOverdue(task, now)) overdueTasks.push(task)
  }

  const total = tasks.length
  const done = counts.COMPLETED + counts.CLOSED
  const nonCancelled = total - counts.CANCELLED
  const compliance = nonCancelled > 0 ? Math.round((done / nonCancelled) * 100) : 0

  const statusDistribution: StatusDistribution[] = (
    ['PENDING', 'IN_PROGRESS', 'DELAYED', 'COMPLETED', 'CLOSED', 'CANCELLED'] as TaskStatus[]
  )
    .map((status) => ({ status, count: counts[status] }))
    .filter((entry) => entry.count > 0)

  const workload: WorkloadEntry[] = Array.from(workloadMap.entries())
    .map(([responsibleUserId, value]) => ({ responsibleUserId, ...value }))
    .sort((a, b) => b.count - a.count || b.active - a.active)

  const upcomingDeadlines: DeadlineEntry[] = tasks
    .filter(
      (task) =>
        task.dueDate &&
        !DONE_STATUSES.includes(task.status) &&
        task.status !== 'CANCELLED',
    )
    .map((task) => ({ task, isOverdue: isOverdue(task, now) }))
    .sort((a, b) => Date.parse(a.task.dueDate ?? '') - Date.parse(b.task.dueDate ?? ''))

  overdueTasks.sort((a, b) => Date.parse(a.dueDate ?? '') - Date.parse(b.dueDate ?? ''))

  return {
    total,
    pending: counts.PENDING,
    inProgress: counts.IN_PROGRESS,
    completed: counts.COMPLETED,
    delayed: counts.DELAYED,
    closed: counts.CLOSED,
    cancelled: counts.CANCELLED,
    overdue: overdueTasks.length,
    compliance,
    statusDistribution,
    workload,
    upcomingDeadlines,
    overdueTasks,
  }
}
