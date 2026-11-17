import { useMemo } from 'react'
import { formatDateTimeLocal } from './taskFormRules'

type DueDatePickerProps = {
  id: string
  value: string
  onChange: (value: string) => void
  now: Date
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  onFocus?: () => void
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Divide un string datetime-local (YYYY-MM-DDTHH:mm) en fecha y hora. */
function splitValue(value: string): { date: string; time: string } {
  if (!value) return { date: '', time: '' }
  const [date = '', time = ''] = value.split('T')
  return { date, time: time.slice(0, 5) }
}

/** Combina fecha y hora en el string datetime-local que consume el formulario. */
function joinValue(date: string, time: string): string {
  if (!date) return ''
  return `${date}T${time || '09:00'}`
}

/** Genera opciones de hora cada 30 minutos (00:00 … 23:30) con etiqueta de 12h. */
function buildTimeOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    const value = `${pad(hour)}:${pad(minute)}`
    const period = hour < 12 ? 'a. m.' : 'p. m.'
    const hour12 = hour % 12 === 0 ? 12 : hour % 12
    options.push({ value, label: `${hour12}:${pad(minute)} ${period}` })
  }
  return options
}

type Shortcut = { label: string; compute: (now: Date) => Date }

const SHORTCUTS: Shortcut[] = [
  {
    label: 'En 1 hora',
    compute: (now) => {
      const date = new Date(now.getTime())
      date.setHours(date.getHours() + 1, date.getMinutes(), 0, 0)
      return date
    },
  },
  {
    label: 'Hoy 5:00 p. m.',
    compute: (now) => {
      const date = new Date(now.getTime())
      date.setHours(17, 0, 0, 0)
      return date
    },
  },
  {
    label: 'Mañana 9:00 a. m.',
    compute: (now) => {
      const date = new Date(now.getTime())
      date.setDate(date.getDate() + 1)
      date.setHours(9, 0, 0, 0)
      return date
    },
  },
  {
    label: 'En una semana',
    compute: (now) => {
      const date = new Date(now.getTime())
      date.setDate(date.getDate() + 7)
      date.setHours(9, 0, 0, 0)
      return date
    },
  },
]

export function DueDatePicker({ id, value, onChange, now, disabled, invalid, describedBy, onFocus }: DueDatePickerProps) {
  const { date, time } = splitValue(value)
  const timeOptions = useMemo(buildTimeOptions, [])
  const minDate = formatDateTimeLocal(now).split('T')[0]
  const hasCustomTime = time !== '' && !timeOptions.some(option => option.value === time)

  function emit(nextDate: string, nextTime: string) {
    onChange(joinValue(nextDate, nextTime))
  }

  function applyShortcut(shortcut: Shortcut) {
    const target = shortcut.compute(now)
    target.setSeconds(0, 0)
    onChange(formatDateTimeLocal(target))
  }

  return (
    <div className="due-date-picker">
      {/* Fuente de verdad accesible: conserva el valor en formato datetime-local. */}
      <input
        id={id}
        type="datetime-local"
        className="sr-only-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="due-date-grid">
        <div className="due-date-field">
          <label htmlFor={`${id}-date`} className="due-date-sublabel">Día</label>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            min={minDate}
            disabled={disabled}
            aria-invalid={invalid}
            onFocus={onFocus}
            onChange={(event) => emit(event.target.value, time)}
          />
        </div>
        <div className="due-date-field">
          <label htmlFor={`${id}-time`} className="due-date-sublabel">Hora</label>
          <select
            id={`${id}-time`}
            value={time}
            disabled={disabled}
            aria-invalid={invalid}
            onFocus={onFocus}
            onChange={(event) => emit(date, event.target.value)}
          >
            <option value="">Selecciona una hora</option>
            {hasCustomTime && <option value={time}>{time}</option>}
            {timeOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="due-date-shortcuts" role="group" aria-label="Atajos de fecha límite">
        {SHORTCUTS.map(shortcut => (
          <button
            key={shortcut.label}
            type="button"
            className="chip-button"
            disabled={disabled}
            onClick={() => applyShortcut(shortcut)}
          >
            {shortcut.label}
          </button>
        ))}
      </div>
    </div>
  )
}
