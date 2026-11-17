import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import { Modal } from '../../app/Modal'
import { TaskRequestError } from './tasksApi'
import { ResponsibleCombobox } from './ResponsibleCombobox'
import type { TeamMember } from '../teams/teamsApi'

const ACTIONS = {
  assign: { title: 'Asignar tarea', label: 'Responsable', submit: 'Asignar tarea' },
  reassign: { title: 'Reasignar tarea', label: 'Nuevo responsable', submit: 'Reasignar tarea' },
  observation: { title: 'Agregar observación', label: 'Observación', submit: 'Guardar observación' },
  cancel: { title: 'Cancelar tarea', label: 'Motivo de la cancelación (opcional)', submit: 'Cancelar tarea' },
}

type TaskActionModalProps = {
  action: keyof typeof ACTIONS
  taskTitle: string
  onSubmit: (value: string) => Promise<void>
  onClose: () => void
  fallbackFocusRef?: RefObject<HTMLElement | null>
  members?: TeamMember[]
  isLoadingMembers?: boolean
  membersFailed?: boolean
}

export function TaskActionModal({
  action,
  taskTitle,
  onSubmit,
  onClose,
  fallbackFocusRef,
  members = [],
  isLoadingMembers = false,
  membersFailed = false,
}: TaskActionModalProps) {
  const [value, setValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const comboboxInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  const hintId = useId()
  const config = ACTIONS[action]
  const isResponsible = action === 'assign' || action === 'reassign'
  const isRequired = action !== 'cancel'
  const invalidResponsible = isResponsible && (isLoadingMembers || membersFailed || !members.some(member => member.email === value))

  // The dialog can open while members are loading and the input is disabled.
  // Focus it once ready so its existing combobox immediately presents options.
  useEffect(() => {
    if (isResponsible && !isLoadingMembers && !membersFailed) comboboxInputRef.current?.focus()
  }, [isResponsible, isLoadingMembers, membersFailed])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || invalidResponsible || (isRequired && !value.trim())) return
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
    setError('')
  }

  return (
    <Modal title={config.title} description={`Tarea: ${taskTitle}`} onClose={onClose}
      isBusy={isSubmitting} initialFocusRef={isResponsible ? comboboxInputRef : textareaRef} fallbackFocusRef={fallbackFocusRef}>
      <form className="app-modal-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <div className="task-form-field">
          <label htmlFor={fieldId}>{config.label}</label>
          {isResponsible ? (
            <ResponsibleCombobox
              id={fieldId}
              inputRef={comboboxInputRef}
              members={members}
              value={value}
              onChange={handleChange}
              isLoading={isLoadingMembers}
              disabled={isSubmitting || membersFailed}
              placeholder="Buscar colaborador…"
              emptyMessage="No hay colaboradores disponibles. Agrégalos al equipo antes de asignar la tarea."
            />
          ) : (
            <textarea ref={textareaRef} id={fieldId} value={value} required={isRequired} maxLength={2000}
              rows={4} disabled={isSubmitting} onChange={event => handleChange(event.target.value)}
              aria-describedby={hintId} />
          )}
          {!isResponsible && <span id={hintId} className="app-modal-hint">Máximo 2000 caracteres.</span>}
        </div>
        {isResponsible && membersFailed && <p className="feedback error" role="alert">No se pudieron cargar los colaboradores. Cierra y vuelve a abrir la asignación para reintentar.</p>}
        {error && <p className="feedback error" role="alert">{error}</p>}
        {isSubmitting && <p className="app-modal-hint" role="status">Guardando cambios…</p>}
        <footer className="app-modal-actions">
          <button type="button" className="secondary-button" disabled={isSubmitting} onClick={onClose}>
            {action === 'cancel' ? 'Volver' : 'Cancelar'}
          </button>
          <button type="submit" className={action === 'cancel' ? 'danger-button' : 'primary-button'}
            disabled={isSubmitting || invalidResponsible || (isRequired && !value.trim())}>
            {isSubmitting ? 'Guardando…' : config.submit}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
