import { SearchCombobox } from '../../app/SearchCombobox'
import type { RefObject } from 'react'
import { teamMemberName } from '../teams/teamMemberName'
import type { TeamMember } from '../teams/teamsApi'

type ResponsibleComboboxProps = {
  id: string
  members: TeamMember[]
  value: string
  onChange: (email: string) => void
  disabled?: boolean
  emptyMessage?: string
  placeholder?: string
  isLoading?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
}

function initials(member: TeamMember): string {
  const first = member.firstName?.trim()[0]
  const last = member.lastName?.trim()[0]
  const letters = first && last ? first + last : (first ?? member.email[0])
  return letters.toUpperCase()
}

export function ResponsibleCombobox({ members, emptyMessage, ...props }: ResponsibleComboboxProps) {
  return <SearchCombobox {...props}
    options={members.map(member => ({ value: member.email, label: teamMemberName(member), description: member.email, avatar: initials(member) }))}
    placeholder={props.placeholder ?? 'Buscar colaborador…'}
    loadingMessage="Cargando colaboradores…"
    emptyMessage={emptyMessage ?? 'Este equipo aún no tiene colaboradores. Puedes crear la tarea sin responsable.'}
    noResultsLabel="Ningún colaborador del equipo"
    clearLabel="Quitar responsable" />
}
