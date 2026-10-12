import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toast } from '../Toast'

function setup(props: Partial<React.ComponentProps<typeof Toast>> = {}) {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <Toast message='Tarea "Informe" creada correctamente.' onClose={onClose} action={{ label: 'Ver tarea', to: '/tasks/t1' }} {...props} />
    </MemoryRouter>,
  )
  return { onClose }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Toast notice shown after a successful action.
 * Each test documents: Case (scenario), Expected (required behavior) and Result (what is verified).
 */
describe('Toast', () => {
  /**
   * Case: a task was created.
   * Expected: the exact message is announced with role status and a link to the task is offered.
   * Result: the status contains the message and the "Ver tarea" link points to /tasks/t1.
   */
  it('shows the message with role status and the action link', () => {
    setup()

    expect(screen.getByRole('status')).toHaveTextContent('Tarea "Informe" creada correctamente.')
    expect(screen.getByRole('link', { name: 'Ver tarea' })).toHaveAttribute('href', '/tasks/t1')
  })

  /**
   * Case: the user clicks the close button.
   * Expected: the notice is dismissed.
   * Result: onClose is called once.
   */
  it('closes with the close button', () => {
    const { onClose } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * Case: the user presses Escape.
   * Expected: the notice is dismissed.
   * Result: onClose is called.
   */
  it('closes with Escape', () => {
    const { onClose } = setup()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * Case: nobody interacts with the notice.
   * Expected: it stays visible for at least 8 seconds and then closes by itself.
   * Result: not closed at 7.9 s, closed at 8 s.
   */
  it('closes by itself after 8 seconds', () => {
    const { onClose } = setup()

    act(() => { vi.advanceTimersByTime(7900) })
    expect(onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(100) })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * Case: the cursor is over the notice.
   * Expected: the timer is paused while the cursor is over it and restarts when it leaves.
   * Result: it does not close after 20 s of hover, and closes 8 s after the cursor leaves.
   */
  it('pauses while the cursor is over it', () => {
    const { onClose } = setup()

    fireEvent.mouseEnter(screen.getByRole('status'))
    act(() => { vi.advanceTimersByTime(20000) })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseLeave(screen.getByRole('status'))
    act(() => { vi.advanceTimersByTime(8000) })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  /**
   * Case: the keyboard focus is inside the notice.
   * Expected: the timer is paused while it has focus.
   * Result: it does not close after 20 s with the link focused.
   */
  it('pauses while it has keyboard focus', () => {
    const { onClose } = setup()

    fireEvent.focus(screen.getByRole('link', { name: 'Ver tarea' }))
    act(() => { vi.advanceTimersByTime(20000) })

    expect(onClose).not.toHaveBeenCalled()
  })

  /**
   * Case: the notice has no action.
   * Expected: only the message and the close button are rendered.
   * Result: there is no link.
   */
  it('renders without action link', () => {
    setup({ action: undefined })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
