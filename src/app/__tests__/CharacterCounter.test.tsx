import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CharacterCounter } from '../CharacterCounter'

/**
 * Character counter shown under limited text fields.
 * Each test documents: Case (scenario), Expected (required behavior) and Result (what is verified).
 */
describe('CharacterCounter', () => {
  /**
   * Case: a field with 10 of 150 characters.
   * Expected: the counter shows "10/150" without warning.
   * Result: the text is rendered and the warning class and notice are absent.
   */
  it('shows the current length and the maximum', () => {
    const { container } = render(<CharacterCounter id="counter" length={10} max={150} />)

    expect(screen.getByText('10/150')).toBeInTheDocument()
    expect(container.querySelector('#counter')).not.toHaveClass('near-limit')
    expect(screen.queryByText(/Llegaste al máximo/)).not.toBeInTheDocument()
  })

  /**
   * Case: a field with 134 of 150 characters (just below 90 %).
   * Expected: no warning.
   * Result: the warning class is absent.
   */
  it('does not warn below 90 % of the limit', () => {
    const { container } = render(<CharacterCounter id="counter" length={134} max={150} />)

    expect(container.querySelector('#counter')).not.toHaveClass('near-limit')
  })

  /**
   * Case: a field with 135 of 150 characters (exactly 90 %).
   * Expected: the counter switches to the warning color, without the limit notice yet.
   * Result: the warning class is present and the notice is absent.
   */
  it('warns from 90 % of the limit', () => {
    const { container } = render(<CharacterCounter id="counter" length={135} max={150} />)

    expect(container.querySelector('#counter')).toHaveClass('near-limit')
    expect(screen.queryByText(/Llegaste al máximo/)).not.toBeInTheDocument()
  })

  /**
   * Case: a field that reached the limit (150 of 150).
   * Expected: the notice "Llegaste al máximo de 150 caracteres" is shown in the warning color.
   * Result: the notice is rendered inside a polite live region and the warning class is present.
   */
  it('shows the limit notice when the maximum is reached', () => {
    const { container } = render(<CharacterCounter id="counter" length={150} max={150} />)

    const notice = screen.getByText('Llegaste al máximo de 150 caracteres')
    expect(notice).toHaveAttribute('aria-live', 'polite')
    expect(container.querySelector('#counter')).toHaveClass('near-limit')
  })
})
