import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'

type ModalProps = {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  isBusy?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  fallbackFocusRef?: RefObject<HTMLElement | null>
}

export function Modal({ title, description, children, onClose, isBusy = false, initialFocusRef, fallbackFocusRef }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const trigger = document.activeElement
    const fallbackFocus = fallbackFocusRef?.current
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    initialFocusRef?.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (trigger instanceof HTMLElement && trigger.isConnected && !trigger.matches(':disabled')) {
        trigger.focus()
      } else {
        fallbackFocus?.focus()
      }
    }
  }, [initialFocusRef, fallbackFocusRef])

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, [tabindex]',
    )).filter(control => !control.matches(':disabled') && control.tabIndex >= 0 && control.getClientRects().length > 0)
    const first = controls[0]
    const last = controls.at(-1)
    if (!first || !last) {
      event.preventDefault()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <dialog ref={dialogRef} className="app-modal" aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onKeyDown={handleKeyDown}
      onCancel={event => { event.preventDefault(); if (!isBusy) onClose() }}>
      <header className="app-modal-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="secondary-button app-modal-close" aria-label="Cerrar modal"
          disabled={isBusy} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      {description && <p id={descriptionId} className="app-modal-description">{description}</p>}
      {children}
    </dialog>
  )
}
