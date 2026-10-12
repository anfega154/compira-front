export const PAST_DUE_DATE_MESSAGE = 'La fecha límite no puede ser anterior al momento actual'
export const NO_TEAM_MESSAGE = 'Necesitas un equipo asignado por el Administrador para crear tareas.'
const PAST_DUE_DATE_REQUIREMENT = 'la fecha límite debe ser posterior al momento actual'

const pad = (value: number) => String(value).padStart(2, '0')

export function formatDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function getMinDueDate(now: Date): string {
  const nextMinute = new Date(now.getTime())
  nextMinute.setSeconds(0, 0)
  nextMinute.setMinutes(nextMinute.getMinutes() + 1)
  return formatDateTimeLocal(nextMinute)
}

export function isPastDueDate(dueDate: string, now: Date): boolean {
  return dueDate !== '' && new Date(dueDate).getTime() < now.getTime()
}

type RequirementsInput = {
  teamId: string
  title: string
  description: string
  dueDate: string
  now: Date
}

export function getMissingRequirements({ teamId, title, description, dueDate, now }: RequirementsInput): string[] {
  const missing: string[] = []
  if (teamId === '') missing.push('equipo')
  if (title.trim() === '') missing.push('título')
  if (description.trim() === '') missing.push('descripción')
  if (dueDate === '') missing.push('fecha límite')
  else if (isPastDueDate(dueDate, now)) missing.push(PAST_DUE_DATE_REQUIREMENT)
  return missing
}

export function getSubmitHint(input: RequirementsInput & { hasTeams: boolean }): string | null {
  if (!input.hasTeams) return NO_TEAM_MESSAGE
  const missing = getMissingRequirements(input)
  return missing.length > 0 ? `Para crear la tarea falta: ${missing.join(', ')}` : null
}
