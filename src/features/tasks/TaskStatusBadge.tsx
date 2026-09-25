import { TASK_STATUS_LABELS, TASK_STATUS_TONE } from './taskLabels'
import type { TaskStatus } from './types'

type TaskStatusBadgeProps = {
  status: TaskStatus
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  return (
    <span className={`task-status-badge ${TASK_STATUS_TONE[status]}`}>
      {TASK_STATUS_LABELS[status]}
    </span>
  )
}
