import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Team, module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { TeamsPage } from '../TeamsPage'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); persistSession(module3User('ADMINISTRATOR'), module3Tokens) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })
const noMembers = () => Response.json([])
const member = { id: 'member-1', email: 'member@compira.co', firstName: 'Luis', lastName: 'Pérez' }

it('creates a team and changes its current coordinator', async () => {
  fetchMock.mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json(module3Team)).mockResolvedValueOnce(noMembers())
    .mockResolvedValueOnce(Response.json({ ...module3Team, coordinatorEmail: 'next@compira.co' }))
  const { user } = renderWithProviders(<TeamsPage />)
  await screen.findByText('No hay equipos. Crea el primero para habilitar las tareas y alertas.')
  await user.type(screen.getByLabelText('Nombre del equipo'), module3Team.name)
  await user.type(screen.getByLabelText('Correo del coordinador inicial'), module3Team.coordinatorEmail)
  await user.click(screen.getByRole('button', { name: 'Crear equipo' }))
  await screen.findByText('Equipo creado.')
  await user.type(screen.getByLabelText('Correo del usuario'), 'next@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  expect(await screen.findByText('next@compira.co')).toBeInTheDocument()
})

it.each(['ADMINISTRATOR', 'COORDINATOR'] as const)('allows %s to link collaborators to a selected team', async (role) => {
  persistSession(module3User(role), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
    .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(noMembers())
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.selectOptions(screen.getByLabelText('Acción'), 'member')
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  await screen.findByText('Cambio guardado.')
  expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining('/teams/team-1/members'), expect.objectContaining({ method: 'POST' }))
})


it('allows coordinators only to link, not create teams or change coordinators', async () => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  expect(screen.queryByRole('button', { name: 'Crear equipo' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Cambiar coordinador' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Acción')).toHaveValue('member')
})

it('does not ask coordinators without teams to create one', async () => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([]))
  renderWithProviders(<TeamsPage />)
  expect(await screen.findByText('No tienes equipos asignados. Solicita la asignación al Administrador.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Crear equipo' })).not.toBeInTheDocument()
})

it('keeps team management unavailable to collaborators without requesting teams', () => {
  persistSession(module3User(), module3Tokens)
  renderWithProviders(<TeamsPage />)
  expect(screen.getByRole('alert')).toBeVisible()
  expect(fetchMock).not.toHaveBeenCalled()
})

it('lets an administrator reassign a collaborator to the selected team', async () => {
  persistSession(module3User('ADMINISTRATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
    .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(noMembers())
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.selectOptions(screen.getByLabelText('Acción'), 'reassign')
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  await screen.findByText('Cambio guardado.')
  expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining('/teams/team-1/members/reassign'), expect.objectContaining({ method: 'POST' }))
})

it('hides the reassign action from coordinators', async () => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  expect(screen.queryByRole('option', { name: 'Reasignar colaborador a este equipo' })).not.toBeInTheDocument()
})

it('shows a refused linking request without reporting success', async () => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
    .mockResolvedValueOnce(Response.json({ message: 'No tienes acceso a este equipo' }, { status: 403 }))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No tienes acceso a este equipo')
  expect(screen.queryByText('Cambio guardado.')).not.toBeInTheDocument()
})

it('shows a clear message when the collaborator already belongs to the target team', async () => {
  persistSession(module3User('ADMINISTRATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
    .mockResolvedValueOnce(Response.json({ code: 'TEAM_001', message: 'El colaborador ya pertenece al equipo destino' }, { status: 409 }))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.selectOptions(screen.getByLabelText('Acción'), 'member')
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('El colaborador ya pertenece al equipo destino')
  expect(screen.queryByText('Cambio guardado.')).not.toBeInTheDocument()
})

it.each(['ADMINISTRATOR', 'COORDINATOR'] as const)('does not offer teamless task linking to %s', async role => {
  persistSession(module3User(role), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await screen.findByText('Este equipo no tiene colaboradores.')
  expect(screen.queryByRole('option', { name: /tarea.*sin equipo/i })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Tarea existente')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/members'), expect.anything())
})

it.each(['ADMINISTRATOR', 'COORDINATOR'] as const)('lists the collaborators of the team selected by %s', async role => {
  persistSession(module3User(role), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(Response.json([member]))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  const list = await screen.findByRole('list', { name: 'Colaboradores del equipo' })
  expect(list).toHaveTextContent('Luis Pérez')
  expect(list).toHaveTextContent('member@compira.co')
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/members'), expect.anything())
})

it('shows an empty message when the selected team has no collaborators', async () => {
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  expect(await screen.findByText('Este equipo no tiene colaboradores.')).toBeVisible()
  expect(screen.queryByRole('list', { name: 'Colaboradores del equipo' })).not.toBeInTheDocument()
})

it('shows the collaborators request error without hiding the team actions', async () => {
  fetchMock.mockResolvedValueOnce(Response.json([module3Team]))
    .mockResolvedValueOnce(Response.json({ message: 'No tienes acceso a este equipo' }, { status: 403 }))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  expect(await screen.findByRole('alert')).toHaveTextContent('No tienes acceso a este equipo')
  expect(screen.getByRole('button', { name: 'Guardar cambio' })).toBeEnabled()
})

it.each(['member', 'reassign'] as const)('refreshes the collaborators after a successful %s action', async action => {
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(noMembers())
    .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(Response.json([member]))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await screen.findByText('Este equipo no tiene colaboradores.')
  await user.selectOptions(screen.getByLabelText('Acción'), action)
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  expect(await screen.findByRole('list', { name: 'Colaboradores del equipo' })).toHaveTextContent('Luis Pérez')
  expect(fetchMock).toHaveBeenCalledTimes(4)
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/members'), expect.not.objectContaining({ method: 'POST' }))
})
