import { TASK_STATUS_LABELS, TASK_STATUS_TONE } from './taskLabels'
import type { TaskStatus } from './types'

type TaskStatusBadgeProps = {
  status: TaskStatus
  overdue?: boolean
}

export function TaskStatusBadge({ status, overdue = false }: TaskStatusBadgeProps) {
  const showOverdue = overdue && status !== 'CLOSED' && status !== 'CANCELLED' && status !== 'COMPLETED'
  return (
    <span className="task-status-badges">
      <span className={`task-status-badge ${TASK_STATUS_TONE[status]}`}>
        {TASK_STATUS_LABELS[status]}
      </span>
      {showOverdue && (
        <span className="task-status-badge status-delayed" title="La fecha límite ya venció">
          Retrasada
        </span>
      )}
    </span>
  )
}
