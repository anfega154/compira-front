import type { TeamMember } from './teamsApi'

export function teamMemberName(member: TeamMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.email
}
