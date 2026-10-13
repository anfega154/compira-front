import { describe, expect, it } from 'vitest'
import {
  NO_TEAM_MESSAGE,
  getMinDueDate,
  getMissingRequirements,
  getSubmitHint,
  isPastDueDate,
} from '../taskFormRules'

const now = new Date('2026-10-11T10:00:30')
const futureDate = '2026-10-12T10:00'
const full = { teamId: 'team-1', title: 'Informe', description: 'Detalle', dueDate: futureDate, now }

/**
 * Pure rules of the "Crear tarea" form.
 * Each test documents: Case (scenario), Expected (required behavior) and Result (what is verified).
 */
describe('getMinDueDate', () => {
  /**
   * Case: the current time is 10:00:30.
   * Expected: the minimum selectable date is the next minute, so a date of the current minute does not reach the backend already expired.
   * Result: "2026-10-11T10:01" in datetime-local format.
   */
  it('returns the next minute in datetime-local format', () => {
    expect(getMinDueDate(now)).toBe('2026-10-11T10:01')
  })

  /**
   * Case: the current time is 23:59:10 of the last day of the year.
   * Expected: the next minute rolls over to the next day and year.
   * Result: "2027-01-01T00:00".
   */
  it('rolls over to the next day and year', () => {
    expect(getMinDueDate(new Date('2026-12-31T23:59:10'))).toBe('2027-01-01T00:00')
  })
})

describe('isPastDueDate', () => {
  /**
   * Case: empty, past, current-minute and future dates.
   * Expected: only a date before the current moment is past.
   * Result: empty → false, past → true, future → false.
   */
  it('detects only dates before the current moment', () => {
    expect(isPastDueDate('', now)).toBe(false)
    expect(isPastDueDate('2026-10-11T09:59', now)).toBe(true)
    expect(isPastDueDate(futureDate, now)).toBe(false)
  })
})

describe('getMissingRequirements', () => {
  /**
   * Case: the form is empty.
   * Expected: the four required fields are listed in the order of the form.
   * Result: ["equipo", "título", "descripción", "fecha límite"].
   */
  it('lists the four fields in form order when everything is empty', () => {
    expect(getMissingRequirements({ teamId: '', title: '', description: '', dueDate: '', now }))
      .toEqual(['equipo', 'título', 'descripción', 'fecha límite'])
  })

  /**
   * Case: only the due date is missing; whitespace counts as empty.
   * Expected: only the pending field is listed.
   * Result: ["fecha límite"], and a whitespace-only title or description is reported as missing.
   */
  it('lists only the pending fields', () => {
    expect(getMissingRequirements({ ...full, dueDate: '' })).toEqual(['fecha límite'])
    expect(getMissingRequirements({ ...full, title: '   ', description: ' ' })).toEqual(['título', 'descripción'])
  })

  /**
   * Case: the due date is before the current moment.
   * Expected: the requirement says the date must be later than now.
   * Result: ["la fecha límite debe ser posterior al momento actual"].
   */
  it('reports a past due date', () => {
    expect(getMissingRequirements({ ...full, dueDate: '2026-10-11T09:00' }))
      .toEqual(['la fecha límite debe ser posterior al momento actual'])
  })

  /**
   * Case: everything is filled in with a future date.
   * Expected: nothing is missing.
   * Result: an empty list.
   */
  it('returns an empty list when the form is complete', () => {
    expect(getMissingRequirements(full)).toEqual([])
  })
})

describe('getSubmitHint', () => {
  /**
   * Case: the coordinator has no teams.
   * Expected: the hint explains that an administrator must assign a team.
   * Result: "Necesitas un equipo asignado por el Administrador para crear tareas.".
   */
  it('explains the lack of teams', () => {
    expect(getSubmitHint({ ...full, hasTeams: false })).toBe(NO_TEAM_MESSAGE)
  })

  /**
   * Case: fields are pending.
   * Expected: "Para crear la tarea falta: ..." with only the pending fields.
   * Result: the sentence lists "equipo, título, descripción, fecha límite" for an empty form.
   */
  it('lists the pending fields in a sentence', () => {
    expect(getSubmitHint({ teamId: '', title: '', description: '', dueDate: '', now, hasTeams: true }))
      .toBe('Para crear la tarea falta: equipo, título, descripción, fecha límite')
  })

  /**
   * Case: the form is complete.
   * Expected: there is nothing to explain.
   * Result: null.
   */
  it('returns null when the form is complete', () => {
    expect(getSubmitHint({ ...full, hasTeams: true })).toBeNull()
  })
})
