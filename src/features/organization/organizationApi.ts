import { authenticatedRequest } from '../auth/authenticatedRequest'

export type OrganizationSettings = { timeZone: string | null; notificationsEnabled: boolean }
const SETTINGS_PATH = '/organization/settings'

function parseSettings(value: unknown): OrganizationSettings {
  if (typeof value !== 'object' || value === null || !('timeZone' in value)
    || !(value.timeZone === null || typeof value.timeZone === 'string')
    || !('notificationsEnabled' in value) || typeof value.notificationsEnabled !== 'boolean') {
    throw new Error('Configuración recibida inválida.')
  }
  return { timeZone: value.timeZone, notificationsEnabled: value.notificationsEnabled }
}

export async function getOrganizationSettings(signal: AbortSignal): Promise<OrganizationSettings> {
  return parseSettings(await (await authenticatedRequest(SETTINGS_PATH, { signal })).json())
}

export async function saveOrganizationSettings(settings: OrganizationSettings): Promise<OrganizationSettings> {
  return parseSettings(await (await authenticatedRequest(SETTINGS_PATH, { method: 'PUT', body: JSON.stringify(settings) })).json())
}
