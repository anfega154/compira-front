import { describe, expect, it } from 'vitest'
import { formatTimeZoneLabel, getDeviceTimeZone } from '../timeZone'

const date = new Date('2026-10-11T12:00:00Z')

/**
 * Time zone labels shown under the due date field.
 * Each test documents: Case (scenario), Expected (required behavior) and Result (what is verified).
 */
describe('formatTimeZoneLabel', () => {
  /**
   * Case: a zone behind UTC (America/Bogota).
   * Expected: the label shows the zone and its offset with the minus sign.
   * Result: "America/Bogota (UTC−05:00)".
   */
  it('formats a zone behind UTC', () => {
    expect(formatTimeZoneLabel('America/Bogota', date)).toBe('America/Bogota (UTC−05:00)')
  })

  /**
   * Case: a zone ahead of UTC (Asia/Kolkata, with a half-hour offset).
   * Expected: the label shows the offset with the plus sign and the minutes.
   * Result: "Asia/Kolkata (UTC+05:30)".
   */
  it('formats a zone ahead of UTC with minutes', () => {
    expect(formatTimeZoneLabel('Asia/Kolkata', date)).toBe('Asia/Kolkata (UTC+05:30)')
  })

  /**
   * Case: UTC itself.
   * Expected: the offset is shown as +00:00.
   * Result: "UTC (UTC+00:00)".
   */
  it('formats UTC with a zero offset', () => {
    expect(formatTimeZoneLabel('UTC', date)).toBe('UTC (UTC+00:00)')
  })
})

describe('getDeviceTimeZone', () => {
  /**
   * Case: the device time zone is requested.
   * Expected: the IANA name resolved by the browser.
   * Result: a non-empty string equal to the one resolved by Intl.
   */
  it('returns the IANA zone resolved by the browser', () => {
    expect(getDeviceTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(getDeviceTimeZone().length).toBeGreaterThan(0)
  })
})
