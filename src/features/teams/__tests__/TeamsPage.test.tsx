import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { module3Team, module3Tokens, module3User } from '../../../test/module3TestData'
import { persistSession } from '../../auth/authStorage'
import { TeamsPage } from '../TeamsPage'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); persistSession(module3User('ADMINISTRATOR'), module3Tokens) })
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

it('creates a team and changes its current coordinator', async () => {
  fetchMock.mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json(module3Team))
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

it.each(['ADMINISTRATOR', 'COORDINATOR'] as const)('allows %s to link collaborators and tasks to a selected team', async (role) => {
  persistSession(module3User(role), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 204 }))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.selectOptions(screen.getByLabelText('Acción'), 'member')
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  await screen.findByText('Cambio guardado.')
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/members'), expect.objectContaining({ method: 'POST' }))
  await user.selectOptions(screen.getByLabelText('Acción'), 'task')
  await user.type(screen.getByLabelText('Identificador de la tarea'), '11111111-1111-1111-1111-111111111111')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  await screen.findByText('Cambio guardado.')
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/tasks'), expect.objectContaining({ method: 'POST' }))
})


it('allows coordinators only to link, not create teams or change coordinators', async () => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team]))
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
  fetchMock.mockResolvedValueOnce(Response.json([module3Team])).mockResolvedValueOnce(new Response(null, { status: 204 }))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.selectOptions(screen.getByLabelText('Acción'), 'reassign')
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  await screen.findByText('Cambio guardado.')
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('/teams/team-1/members/reassign'), expect.objectContaining({ method: 'POST' }))
})

it('hides the reassign action from coordinators', async () => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team]))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  expect(screen.queryByRole('option', { name: 'Reasignar colaborador a este equipo' })).not.toBeInTheDocument()
})

it('shows a refused linking request without reporting success', async () => {
  persistSession(module3User('COORDINATOR'), module3Tokens)
  fetchMock.mockResolvedValueOnce(Response.json([module3Team]))
    .mockResolvedValueOnce(Response.json({ message: 'No tienes acceso a este equipo' }, { status: 403 }))
  const { user } = renderWithProviders(<TeamsPage />)
  await user.selectOptions(await screen.findByLabelText('Equipo'), module3Team.id)
  await user.type(screen.getByLabelText('Correo del usuario'), 'member@compira.co')
  await user.click(screen.getByRole('button', { name: 'Guardar cambio' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permiso para realizar esta acción.')
  expect(screen.queryByText('Cambio guardado.')).not.toBeInTheDocument()
})
