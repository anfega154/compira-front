import { describe, expect, it } from 'vitest'
import { computeDashboardMetrics } from '../dashboardMetrics'
import type { Task, TaskStatus } from '../../tasks/types'

const NOW = Date.parse('2026-06-15T12:00:00.000Z')

function task(partial: Partial<Task> & { id: string; status: TaskStatus }): Task {
  return {
    title: `Task ${partial.id}`,
    description: null,
    dueDate: null,
    responsibleUserId: null,
    createdByUserId: 'creator',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...partial,
  }
}

describe('computeDashboardMetrics', () => {
  it('returns zeroed metrics for an empty list', () => {
    const metrics = computeDashboardMetrics([], NOW)
    expect(metrics.total).toBe(0)
    expect(metrics.compliance).toBe(0)
    expect(metrics.statusDistribution).toEqual([])
    expect(metrics.workload).toEqual([])
    expect(metrics.upcomingDeadlines).toEqual([])
    expect(metrics.overdueTasks).toEqual([])
  })

  it('counts tasks per status', () => {
    const metrics = computeDashboardMetrics(
      [
        task({ id: '1', status: 'PENDING' }),
        task({ id: '2', status: 'IN_PROGRESS' }),
        task({ id: '3', status: 'COMPLETED' }),
        task({ id: '4', status: 'CLOSED' }),
        task({ id: '5', status: 'CANCELLED' }),
        task({ id: '6', status: 'DELAYED' }),
      ],
      NOW,
    )
    expect(metrics.total).toBe(6)
    expect(metrics.pending).toBe(1)
    expect(metrics.inProgress).toBe(1)
    expect(metrics.completed).toBe(1)
    expect(metrics.closed).toBe(1)
    expect(metrics.cancelled).toBe(1)
    expect(metrics.delayed).toBe(1)
  })

  it('computes compliance as done over non-cancelled tasks', () => {
    const metrics = computeDashboardMetrics(
      [
        task({ id: '1', status: 'COMPLETED' }),
        task({ id: '2', status: 'CLOSED' }),
        task({ id: '3', status: 'PENDING' }),
        task({ id: '4', status: 'CANCELLED' }),
      ],
      NOW,
    )
    // 2 done out of 3 non-cancelled = 67%
    expect(metrics.compliance).toBe(67)
  })

  it('flags past-due active tasks as overdue but not finished or cancelled ones', () => {
    const metrics = computeDashboardMetrics(
      [
        task({ id: '1', status: 'PENDING', dueDate: '2026-06-01T00:00:00.000Z' }),
        task({ id: '2', status: 'COMPLETED', dueDate: '2026-06-01T00:00:00.000Z' }),
        task({ id: '3', status: 'CANCELLED', dueDate: '2026-06-01T00:00:00.000Z' }),
        task({ id: '4', status: 'IN_PROGRESS', dueDate: '2026-12-01T00:00:00.000Z' }),
      ],
      NOW,
    )
    expect(metrics.overdue).toBe(1)
    expect(metrics.overdueTasks.map((entry) => entry.id)).toEqual(['1'])
  })

  it('aggregates workload per responsible and orders by volume', () => {
    const metrics = computeDashboardMetrics(
      [
        task({ id: '1', status: 'PENDING', responsibleUserId: 'user-a' }),
        task({ id: '2', status: 'IN_PROGRESS', responsibleUserId: 'user-a' }),
        task({ id: '3', status: 'COMPLETED', responsibleUserId: 'user-b' }),
      ],
      NOW,
    )
    expect(metrics.workload).toEqual([
      { responsibleUserId: 'user-a', count: 2, active: 2 },
      { responsibleUserId: 'user-b', count: 1, active: 0 },
    ])
  })

  it('orders upcoming deadlines ascending and excludes finished/cancelled', () => {
    const metrics = computeDashboardMetrics(
      [
        task({ id: '1', status: 'PENDING', dueDate: '2026-07-01T00:00:00.000Z' }),
        task({ id: '2', status: 'IN_PROGRESS', dueDate: '2026-06-20T00:00:00.000Z' }),
        task({ id: '3', status: 'COMPLETED', dueDate: '2026-06-18T00:00:00.000Z' }),
      ],
      NOW,
    )
    expect(metrics.upcomingDeadlines.map((entry) => entry.task.id)).toEqual(['2', '1'])
  })
})
