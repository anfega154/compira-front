import { useId, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import { Modal } from '../../app/Modal'
import { TaskRequestError } from './tasksApi'

const ACTIONS = {
  reassign: { title: 'Reasignar tarea', label: 'Correo del nuevo responsable', submit: 'Reasignar tarea' },
  observation: { title: 'Agregar observación', label: 'Observación', submit: 'Guardar observación' },
  cancel: { title: 'Cancelar tarea', label: 'Motivo de la cancelación (opcional)', submit: 'Cancelar tarea' },
}

type TaskActionModalProps = {
  action: keyof typeof ACTIONS
  taskTitle: string
  onSubmit: (value: string) => Promise<void>
  onClose: () => void
  fallbackFocusRef?: RefObject<HTMLElement | null>
}

export function TaskActionModal({ action, taskTitle, onSubmit, onClose, fallbackFocusRef }: TaskActionModalProps) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  const errorId = useId()
  const hintId = useId()
  const config = ACTIONS[action]
  const isEmail = action === 'reassign'
  const isRequired = action !== 'cancel'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || (isRequired && !value.trim())) return
    if (isEmail && inputRef.current?.validity.typeMismatch) {
      setFieldError('Ingresa un correo electrónico válido.')
      inputRef.current.focus()
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit(value.trim())
      onClose()
    } catch (requestError) {
      setError(requestError instanceof TaskRequestError ? requestError.message : 'No se pudo guardar el cambio. Intenta nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleChange(nextValue: string) {
    setValue(nextValue)
    setFieldError('')
    setError('')
  }

  return (
    <Modal title={config.title} description={`Tarea: ${taskTitle}`} onClose={onClose}
      isBusy={isSubmitting} initialFocusRef={isEmail ? inputRef : textareaRef} fallbackFocusRef={fallbackFocusRef}>
      <form className="app-modal-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <div className="task-form-field">
          <label htmlFor={fieldId}>{config.label}</label>
          {isEmail ? <input ref={inputRef} id={fieldId} type="email" value={value} required
            disabled={isSubmitting} onChange={event => handleChange(event.target.value)}
            placeholder="colaborador@empresa.com" aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined} />
            : <textarea ref={textareaRef} id={fieldId} value={value} required={isRequired} maxLength={2000}
              rows={4} disabled={isSubmitting} onChange={event => handleChange(event.target.value)}
              aria-describedby={hintId} />}
          {!isEmail && <span id={hintId} className="app-modal-hint">Máximo 2000 caracteres.</span>}
          {fieldError && <p id={errorId} className="feedback error" role="alert">{fieldError}</p>}
        </div>
        {error && <p className="feedback error" role="alert">{error}</p>}
        {isSubmitting && <p className="app-modal-hint" role="status">Guardando cambios…</p>}
        <footer className="app-modal-actions">
          <button type="button" className="secondary-button" disabled={isSubmitting} onClick={onClose}>
            {action === 'cancel' ? 'Volver' : 'Cancelar'}
          </button>
          <button type="submit" className={action === 'cancel' ? 'danger-button' : 'primary-button'}
            disabled={isSubmitting || (isRequired && !value.trim())}>
            {isSubmitting ? 'Guardando…' : config.submit}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
