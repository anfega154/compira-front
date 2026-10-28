import { describe, expect, it } from 'vitest'
import { TASK_EVENT_LABELS } from '../taskLabels'

/**
 * HU-12 · Etiquetas del historial de la tarea.
 * Each test documents: Case (scenario), Expected (required behavior) and Result (what is verified).
 */
describe('TASK_EVENT_LABELS', () => {
  /**
   * Case: the history of a task is displayed.
   * Expected: every event uses the exact label agreed for the history ("Tarea creada", "Responsable asignado", ...).
   * Result: the 7 labels match exactly, so an accidental change is detected.
   */
  it('keeps the exact label of each history event', () => {
    expect(TASK_EVENT_LABELS).toEqual({
      CREATED: 'Tarea creada',
      ASSIGNED: 'Responsable asignado',
      STATUS_CHANGED: 'Cambio de estado',
      OBSERVATION_ADDED: 'Observación registrada',
      REASSIGNED: 'Tarea reasignada',
      CANCELLED: 'Tarea cancelada',
      CLOSED: 'Tarea cerrada',
    })
  })
})
