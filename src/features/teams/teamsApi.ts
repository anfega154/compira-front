import { authenticatedRequest } from '../auth/authenticatedRequest'

export type Team = { id: string; name: string; coordinatorUserId: string; coordinatorEmail: string }
const BASE = '/teams'

function isTeam(value: unknown): value is Team {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string'
    && 'name' in value && typeof value.name === 'string'
    && 'coordinatorUserId' in value && typeof value.coordinatorUserId === 'string'
    && 'coordinatorEmail' in value && typeof value.coordinatorEmail === 'string'
}

export async function getTeams(signal: AbortSignal): Promise<Team[]> {
  const teams: unknown = await (await authenticatedRequest(BASE, { signal })).json()
  if (!Array.isArray(teams) || !teams.every(isTeam)) throw new Error('Respuesta de equipos inválida.')
  return teams
}

export async function createTeam(name: string, coordinatorEmail: string): Promise<Team> {
  const team: unknown = await (await authenticatedRequest(BASE, { method: 'POST', body: JSON.stringify({ name, coordinatorEmail }) })).json()
  if (!isTeam(team)) throw new Error('Respuesta de equipo inválida.')
  return team
}

export async function changeCoordinator(teamId: string, email: string): Promise<Team> {
  const team: unknown = await (await authenticatedRequest(`${BASE}/${encodeURIComponent(teamId)}/coordinator`, { method: 'PUT', body: JSON.stringify({ email }) })).json()
  if (!isTeam(team)) throw new Error('Respuesta de equipo inválida.')
  return team
}

export async function addTeamMember(teamId: string, email: string): Promise<void> {
  await authenticatedRequest(`${BASE}/${encodeURIComponent(teamId)}/members`, { method: 'POST', body: JSON.stringify({ email }) })
}

export async function reassignTeamMember(teamId: string, email: string): Promise<void> {
  await authenticatedRequest(`${BASE}/${encodeURIComponent(teamId)}/members/reassign`, { method: 'POST', body: JSON.stringify({ email }) })
}

export type TeamMember = { id: string; email: string; firstName: string | null; lastName: string | null }

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isTeamMember(value: unknown): value is TeamMember {
  return typeof value === 'object' && value !== null
    && 'id' in value && typeof value.id === 'string'
    && 'email' in value && typeof value.email === 'string'
    && 'firstName' in value && isNullableString(value.firstName)
    && 'lastName' in value && isNullableString(value.lastName)
}

export async function getTeamMembers(teamId: string, signal: AbortSignal): Promise<TeamMember[]> {
  const members: unknown = await (await authenticatedRequest(`${BASE}/${encodeURIComponent(teamId)}/members`, { signal })).json()
  if (!Array.isArray(members) || !members.every(isTeamMember)) throw new Error('Respuesta de miembros inválida.')
  return members
}
