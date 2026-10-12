import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { TeamMember } from '../teams/teamsApi'

type ResponsibleComboboxProps = {
  id: string
  members: TeamMember[]
  value: string
  onChange: (email: string) => void
  disabled?: boolean
  placeholder?: string
  isLoading?: boolean
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function fullName(member: TeamMember): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim()
  return name || member.email
}

function initials(member: TeamMember): string {
  const first = member.firstName?.trim()[0]
  const last = member.lastName?.trim()[0]
  const letters = first && last ? first + last : (first ?? member.email[0])
  return letters.toUpperCase()
}

export function ResponsibleCombobox({
  id,
  members,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar colaborador…',
  isLoading = false,
}: ResponsibleComboboxProps) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = members.find(member => member.email === value)
  const filtered = useMemo(() => {
    const needle = normalize(query.trim())
    if (!needle) return members
    return members.filter(member => normalize(`${member.firstName ?? ''} ${member.lastName ?? ''} ${member.email}`).includes(needle))
  }, [members, query])

  const isInteractive = !disabled && !isLoading
  const showList = isOpen && isInteractive
  const inputValue = isOpen ? query : selected ? fullName(selected) : ''
  const activeOptionId = showList && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined

  function open() {
    if (!isInteractive) return
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  function select(member: TeamMember) {
    onChange(member.email)
    close()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isInteractive) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) return open()
      setActiveIndex(index => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) return open()
      setActiveIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      if (showList && filtered[activeIndex]) {
        event.preventDefault()
        select(filtered[activeIndex])
      }
    } else if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault()
        close()
      }
    }
  }

  function emptyMessage(): string {
    if (members.length === 0) return 'Este equipo aún no tiene colaboradores. Puedes crear la tarea sin responsable.'
    return `Ningún colaborador del equipo coincide con "${query.trim()}"`
  }

  return (
    <div
      className="combobox"
      ref={containerRef}
      onBlur={event => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) close()
      }}
    >
      <div className="combobox-control">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          value={inputValue}
          placeholder={isLoading ? 'Cargando colaboradores…' : placeholder}
          disabled={!isInteractive}
          onFocus={open}
          onClick={open}
          onChange={event => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        {selected && isInteractive && (
          <button type="button" className="combobox-clear" aria-label="Quitar responsable" onClick={() => onChange('')}>
            ✕
          </button>
        )}
      </div>
      {showList && (
        <ul id={listId} role="listbox" className="combobox-list">
          {filtered.length === 0 && <li className="combobox-empty">{emptyMessage()}</li>}
          {filtered.map((member, index) => (
            <li
              key={member.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={member.email === value}
              className={`combobox-option${index === activeIndex ? ' active' : ''}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => select(member)}
            >
              <span className="combobox-avatar" aria-hidden="true">{initials(member)}</span>
              <span className="combobox-text">
                <span className="combobox-name">{fullName(member)}</span>
                <span className="combobox-email">{member.email}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
