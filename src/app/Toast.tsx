import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type ToastProps = {
  message: string
  onClose: () => void
  action?: { label: string; to: string }
  duration?: number
}

const DEFAULT_DURATION_MS = 8000

export function Toast({ message, onClose, action, duration = DEFAULT_DURATION_MS }: ToastProps) {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [paused, duration, onClose])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="toast"
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-message">{message}</span>
      {action && <Link className="toast-action" to={action.to}>{action.label}</Link>}
      <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={onClose}>✕</button>
    </div>
  )
}
