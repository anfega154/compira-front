import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { getTeamMembers } from '../teamsApi'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  persistSession(module3User('COORDINATOR'), module3Tokens)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
  sessionStorage.clear()
})

/**
 * HU-12 · contrato de GET /teams/{teamId}/members.
 * Each test documents: Case (scenario), Expected (required behavior) and Result (what is verified).
 */
describe('getTeamMembers', () => {
  /**
   * Case: the backend returns the members of the team, some without name.
   * Expected: the list is returned as is, accepting null firstName/lastName.
   * Result: the returned array equals the response and the request is a GET to /teams/team-1/members.
   */
  it('returns the members of the team', async () => {
    const members = [
      { id: 'm1', email: 'ana@compira.co', firstName: 'Ana', lastName: 'García' },
      { id: 'm2', email: 'sin.nombre@compira.co', firstName: null, lastName: null },
    ]
    fetchMock.mockResolvedValueOnce(Response.json(members))

    const result = await getTeamMembers('team-1', new AbortController().signal)

    expect(result).toEqual(members)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/teams\/team-1\/members$/), expect.any(Object))
  })

  /**
   * Case: the team has no collaborators.
   * Expected: an empty list is a valid response.
   * Result: the function resolves with [].
   */
  it('accepts an empty list', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]))

    await expect(getTeamMembers('team-1', new AbortController().signal)).resolves.toEqual([])
  })

  /**
   * Case: the response is not an array of members (missing email).
   * Expected: the shape is validated and an error is raised.
   * Result: it rejects with "Respuesta de miembros inválida.".
   */
  it('rejects a response with an invalid shape', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([{ id: 'm1', firstName: 'Ana', lastName: null }]))

    await expect(getTeamMembers('team-1', new AbortController().signal)).rejects.toThrow('Respuesta de miembros inválida.')
  })

  /**
   * Case: the response is an object instead of a list.
   * Expected: an error is raised.
   * Result: it rejects with "Respuesta de miembros inválida.".
   */
  it('rejects a response that is not a list', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: 'm1' }))

    await expect(getTeamMembers('team-1', new AbortController().signal)).rejects.toThrow('Respuesta de miembros inválida.')
  })

  /**
   * Case: the team id contains characters that are not URL safe.
   * Expected: the id is encoded in the path.
   * Result: the request URL contains the encoded id.
   */
  it('encodes the team id in the URL', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]))

    await getTeamMembers('a/b c', new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/teams/a%2Fb%20c/members'), expect.any(Object))
  })

  /**
   * Case: the backend denies access (403).
   * Expected: the error is propagated to the caller.
   * Result: it rejects with the permission message.
   */
  it('propagates the error when the request fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))

    await expect(getTeamMembers('team-1', new AbortController().signal)).rejects.toThrow('No tienes permiso para realizar esta acción.')
  })
})
