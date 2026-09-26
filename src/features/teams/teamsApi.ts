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

export async function linkExistingTask(teamId: string, taskId: string): Promise<void> {
  await authenticatedRequest(`${BASE}/${encodeURIComponent(teamId)}/tasks`, { method: 'POST', body: JSON.stringify({ taskId }) })
}
