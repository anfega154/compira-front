import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'

export type SearchOption = { value: string; label: string; description?: string; avatar?: string }
type SearchComboboxProps = {
  id: string
  options: SearchOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  isLoading?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  emptyMessage: string
  loadingMessage?: string
  noResultsLabel?: string
  clearLabel: string
}
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function SearchCombobox({ id, options, value, onChange, disabled = false,
  placeholder = 'Buscar…', isLoading = false, inputRef: externalInputRef,
  emptyMessage, loadingMessage = 'Cargando…', noResultsLabel = 'Ningún resultado', clearLabel }: SearchComboboxProps) {
  const listId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const internalInputRef = useRef<HTMLInputElement>(null)
  const inputRef = externalInputRef ?? internalInputRef
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = options.find(option => option.value === value)
  const filtered = useMemo(() => {
    const needle = normalize(query.trim())
    if (!needle) return options
    return options.filter(option => normalize(`${option.label} ${option.description ?? ''}`).includes(needle))
  }, [options, query])

  const isInteractive = !disabled && !isLoading
  const showList = isOpen && isInteractive
  const inputValue = isOpen ? query : selected ? selected.label : ''
  const activeOptionId = showList && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined

  function open() {
    if (!isInteractive) return
    setIsOpen(true)
    if (window.matchMedia?.('(max-width: 640px)').matches) {
      inputRef.current?.scrollIntoView?.({ block: 'center' })
    }
  }

  function close() {
    setIsOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  function select(option: SearchOption) {
    onChange(option.value)
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
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          value={inputValue}
          placeholder={isLoading ? loadingMessage : placeholder}
          disabled={!isInteractive}
          onFocus={open}
          onClick={open}
          onChange={event => {
            if (value) onChange('')
            setQuery(event.target.value)
            setActiveIndex(0)
            setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        {selected && isInteractive && (
          <button type="button" className="combobox-clear" aria-label={clearLabel} onClick={() => onChange('')}>
            ✕
          </button>
        )}
      </div>
      {showList && (
        <ul id={listId} role="listbox" className="combobox-list">
          {filtered.length === 0 && <li className="combobox-empty">{options.length === 0 ? emptyMessage : `${noResultsLabel} coincide con "${query.trim()}"`}</li>}
          {filtered.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`combobox-option${index === activeIndex ? ' active' : ''}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => select(option)}
            >
              {option.avatar && <span className="combobox-avatar" aria-hidden="true">{option.avatar}</span>}
              <span className="combobox-text">
                <span className="combobox-name">{option.label}</span>
                <span className="combobox-email">{option.description}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
