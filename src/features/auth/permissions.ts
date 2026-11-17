import type { UserRole } from '../auth/types'

type RoleAware = { roles: UserRole[] } | null | undefined

function hasRole(user: RoleAware, role: UserRole): boolean {
  return user?.roles.includes(role) ?? false
}

export function isAdministrator(user: RoleAware): boolean {
  return hasRole(user, 'ADMINISTRATOR')
}

export function isCoordinator(user: RoleAware): boolean {
  return hasRole(user, 'COORDINATOR')
}

export function isCollaborator(user: RoleAware): boolean {
  return hasRole(user, 'COLLABORATOR')
}

export function canManageUsers(user: RoleAware): boolean {
  return isAdministrator(user)
}

export function canConfigureOrganization(user: RoleAware): boolean {
  return isAdministrator(user)
}

export function canViewReports(user: RoleAware): boolean {
  return isAdministrator(user) || isCoordinator(user)
}

export function canViewTeams(user: RoleAware): boolean {
  return isAdministrator(user) || isCoordinator(user)
}

export function canCreateTeam(user: RoleAware): boolean {
  return isAdministrator(user)
}

export function canChangeCoordinator(user: RoleAware): boolean {
  return isAdministrator(user)
}

export function canReassignCollaborator(user: RoleAware): boolean {
  return isAdministrator(user)
}

export function canLinkTeamMembersAndTasks(user: RoleAware): boolean {
  return isAdministrator(user) || isCoordinator(user)
}

export function canViewTaskBoard(user: RoleAware): boolean {
  return isAdministrator(user) || isCoordinator(user)
}

export function canManageTaskLifecycle(user: RoleAware): boolean {
  return isCoordinator(user)
}

export function canViewAssignedTasks(user: RoleAware): boolean {
  return isCollaborator(user)
}

export function canReceiveNotifications(user: RoleAware): boolean {
  return isCoordinator(user) || isCollaborator(user)
}
