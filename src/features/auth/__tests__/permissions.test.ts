import { describe, expect, it } from 'vitest'
import type { UserRole } from '../types'
import {
  canConfigureOrganization,
  canCreateTeam,
  canLinkTeamMembersAndTasks,
  canManageTaskLifecycle,
  canManageUsers,
  canReassignCollaborator,
  canReceiveNotifications,
  canViewAssignedTasks,
  canViewReports,
  canViewTaskBoard,
  canViewTeams,
  isAdministrator,
  isCollaborator,
  isCoordinator,
} from '../permissions'

function withRoles(...roles: UserRole[]) {
  return { roles }
}

describe('permissions', () => {
  it('treats null users as having no permissions', () => {
    expect(isAdministrator(null)).toBe(false)
    expect(canManageUsers(undefined)).toBe(false)
    expect(canViewTaskBoard(null)).toBe(false)
    expect(canReceiveNotifications(null)).toBe(false)
  })

  it('grants administrator capabilities', () => {
    const admin = withRoles('ADMINISTRATOR')
    expect(isAdministrator(admin)).toBe(true)
    expect(canManageUsers(admin)).toBe(true)
    expect(canConfigureOrganization(admin)).toBe(true)
    expect(canViewReports(admin)).toBe(true)
    expect(canViewTeams(admin)).toBe(true)
    expect(canCreateTeam(admin)).toBe(true)
    expect(canReassignCollaborator(admin)).toBe(true)
    expect(canLinkTeamMembersAndTasks(admin)).toBe(true)
    expect(canViewTaskBoard(admin)).toBe(true)
    expect(canManageTaskLifecycle(admin)).toBe(false)
    expect(canViewAssignedTasks(admin)).toBe(false)
    expect(canReceiveNotifications(admin)).toBe(false)
  })

  it('grants coordinator capabilities', () => {
    const coordinator = withRoles('COORDINATOR')
    expect(isCoordinator(coordinator)).toBe(true)
    expect(canManageTaskLifecycle(coordinator)).toBe(true)
    expect(canViewTaskBoard(coordinator)).toBe(true)
    expect(canViewReports(coordinator)).toBe(true)
    expect(canViewTeams(coordinator)).toBe(true)
    expect(canLinkTeamMembersAndTasks(coordinator)).toBe(true)
    expect(canReceiveNotifications(coordinator)).toBe(true)
    expect(canCreateTeam(coordinator)).toBe(false)
    expect(canReassignCollaborator(coordinator)).toBe(false)
    expect(canManageUsers(coordinator)).toBe(false)
    expect(canViewAssignedTasks(coordinator)).toBe(false)
  })

  it('grants collaborator capabilities', () => {
    const collaborator = withRoles('COLLABORATOR')
    expect(isCollaborator(collaborator)).toBe(true)
    expect(canViewAssignedTasks(collaborator)).toBe(true)
    expect(canReceiveNotifications(collaborator)).toBe(true)
    expect(canViewTaskBoard(collaborator)).toBe(false)
    expect(canViewReports(collaborator)).toBe(false)
    expect(canViewTeams(collaborator)).toBe(false)
    expect(canManageTaskLifecycle(collaborator)).toBe(false)
    expect(canManageUsers(collaborator)).toBe(false)
  })
})
