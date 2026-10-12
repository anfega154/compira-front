import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/render'
import { CreateTaskPage } from '../CreateTaskPage'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../tasksApi', () => ({
  createTask: vi.fn(),
  TaskRequestError: class TaskRequestError extends Error {
    code: string
    constructor(apiError: { code: string; message: string }) {
      super(apiError.message)
      this.code = apiError.code
    }
  },
}))

vi.mock('../../teams/teamsApi', () => ({ getTeams: vi.fn(), getTeamMembers: vi.fn() }))
import { getTeamMembers, getTeams } from '../../teams/teamsApi'
import { createTask } from '../tasksApi'

const mockCreateTask = vi.mocked(createTask)

const createdTask = {
  id: 't1',
  title: 'Preparar informe',
  description: null,
  dueDate: null,
  status: 'PENDING' as const,
  overdue: false,
  responsibleUserId: null,
  createdByUserId: 'c1',
  createdAt: '',
  updatedAt: '',
}

const teamMembers = [
  { id: 'm1', email: 'ana@compira.co', firstName: 'Ana', lastName: 'García' },
  { id: 'm2', email: 'luis@compira.co', firstName: 'Luis', lastName: 'Pérez' },
]

async function selectResponsible(user: ReturnType<typeof renderWithProviders>['user'], name: RegExp) {
  await user.click(screen.getByLabelText('Responsable (opcional)'))
  await user.click(await screen.findByRole('option', { name }))
}

type TestUser = ReturnType<typeof renderWithProviders>['user']

async function selectTeam(user: TestUser) {
  await screen.findByRole('option', { name: 'Operaciones' })
  await user.selectOptions(screen.getByLabelText('Equipo'), 'team-1')
}

async function fillTaskFields(user: TestUser) {
  await user.type(screen.getByLabelText('Título'), 'Preparar informe')
  await user.type(screen.getByLabelText('Descripción'), 'Informe mensual')
  fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2099-12-31T10:00' } })
}

async function fillRequiredFields(user: TestUser) {
  await selectTeam(user)
  await fillTaskFields(user)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getTeamMembers).mockResolvedValue(teamMembers)
  vi.mocked(getTeams).mockResolvedValue([{ id: 'team-1', name: 'Operaciones', coordinatorUserId: 'c1', coordinatorEmail: 'coordinator@compira.co' }])
})

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * HU-12 · Create task (team coordinator).
 * Each test documents: Case (HU scenario), Expected (required behavior) and Result (what is verified).
 * `it.todo` entries record HU criteria the component does not implement yet.
 */
describe('CreateTaskPage', () => {
  /**
   * Case: the coordinator opens the "Crear tarea" screen.
   * Expected: the form fields and the submit button are shown.
   * Result: the Título and Descripción fields and the "Crear tarea" button exist.
   */
  it('renders the create task form', () => {
    renderWithProviders(<CreateTaskPage />)
    expect(screen.getByLabelText('Título')).toBeInTheDocument()
    expect(screen.getByLabelText('Descripción')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /crear tarea/i })).toBeInTheDocument()
  })

  describe('E1 · create task without responsible', () => {
    /**
     * Case: empty title.
     * Expected: the "Crear tarea" button stays disabled.
     * Result: the button is disabled.
     */
    it('disables submit when title is empty', () => {
      renderWithProviders(<CreateTaskPage />)
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
    })

    /**
     * Case: team, title, description and a future due date, no responsible.
     * Expected: the task is created, "Tarea "[title]" creada correctamente." is shown and the form is cleared.
     * Result: createTask receives the data (ISO date, no responsibleEmail), the exact message appears and the fields are emptied.
     */
    it('creates a task without responsible, shows the exact success message and clears the form', async () => {
      mockCreateTask.mockResolvedValueOnce(createdTask)
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await user.type(screen.getByLabelText('Título'), 'Preparar informe')
      await user.type(screen.getByLabelText('Descripción'), 'Informe mensual')
      fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2099-12-31T10:00' } })
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(mockCreateTask).toHaveBeenCalledWith({
        teamId: 'team-1',
        title: 'Preparar informe',
        description: 'Informe mensual',
        dueDate: new Date('2099-12-31T10:00').toISOString(),
        responsibleEmail: undefined,
      })
      expect(await screen.findByRole('status')).toHaveTextContent('Tarea "Preparar informe" creada correctamente.')
      expect(screen.getByLabelText('Título')).toHaveValue('')
      expect(screen.getByLabelText('Descripción')).toHaveValue('')
      expect(screen.getByLabelText('Fecha límite')).toHaveValue('')
      expect(screen.getByLabelText('Responsable (opcional)')).toHaveValue('')
    })

    /**
     * Case: only team and title are filled in (description and due date are required).
     * Expected: the "Crear tarea" button stays disabled and the task is not created.
     * Result: the button is disabled and createTask is not called.
     */
    it('keeps submit disabled with only team and title', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await user.type(screen.getByLabelText('Título'), 'Preparar informe')

      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
      expect(mockCreateTask).not.toHaveBeenCalled()
    })

    /**
     * Case: team, title, description and due date are filled in.
     * Expected: the task is created and the success message is shown.
     * Result: createTask is called and a "creada correctamente" status appears.
     */
    it('creates a task and shows success message', async () => {
      mockCreateTask.mockResolvedValueOnce(createdTask)
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(mockCreateTask).toHaveBeenCalled()
      expect(await screen.findByRole('status')).toHaveTextContent(/creada correctamente/i)
    })
  })

  describe('E2 · create task with responsible', () => {
    /**
     * Case: besides the basic data, an active collaborator of the team is picked from the list.
     * Expected: the task is created assigned to that responsible.
     * Result: createTask receives responsibleEmail and the success message is shown.
     */
    it('sends the email of the collaborator picked from the list', async () => {
      mockCreateTask.mockResolvedValueOnce({ ...createdTask, responsibleUserId: 'u1' })
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await selectResponsible(user, /Ana García/)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'team-1', responsibleEmail: 'ana@compira.co' }))
      expect(await screen.findByRole('status')).toHaveTextContent(/creada correctamente/i)
    })
  })

  describe('E3 · required fields and length', () => {
    /**
     * Case: a title is typed but no team is selected.
     * Expected: the "Crear tarea" button is disabled and the task is not created.
     * Result: button disabled and createTask not called.
     */
    it('disables submit when no team is selected', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await screen.findByRole('option', { name: 'Operaciones' })
      await user.type(screen.getByLabelText('Título'), 'Preparar informe')

      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
      expect(mockCreateTask).not.toHaveBeenCalled()
    })

    /**
     * Case: a team is selected but the title only has whitespace.
     * Expected: the button stays disabled.
     * Result: button disabled and createTask not called.
     */
    it('disables submit when the title only has whitespace', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await user.type(screen.getByLabelText('Título'), '   ')

      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
      expect(mockCreateTask).not.toHaveBeenCalled()
    })

    /**
     * Case: the title length limit is checked.
     * Expected: the title accepts at most 150 characters.
     * Result: the input has maxLength = 150.
     */
    it('limits the title to 150 characters', () => {
      renderWithProviders(<CreateTaskPage />)
      expect(screen.getByLabelText('Título')).toHaveAttribute('maxLength', '150')
    })

    /**
     * Case: the user pastes a title longer than 150 characters.
     * Expected: the field truncates the text to the 150-character maximum.
     * Result: the title value has exactly 150 characters.
     */
    it('truncates a title longer than 150 characters', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.click(screen.getByLabelText('Título'))
      await user.paste('a'.repeat(151))

      expect(screen.getByLabelText('Título')).toHaveValue('a'.repeat(150))
    })

    /**
     * Case: the description limit is checked.
     * Expected: the description accepts at most 2000 characters.
     * Result: the textarea has maxLength = 2000.
     */
    it('limits the description to 2000 characters', () => {
      renderWithProviders(<CreateTaskPage />)
      expect(screen.getByLabelText('Descripción')).toHaveAttribute('maxLength', '2000')
    })

    /**
     * Case: the user pastes a description longer than 2000 characters.
     * Expected: the field does not accept more than its limit.
     * Result: the description value is truncated to exactly 2000 characters.
     */
    it('truncates a description longer than 2000 characters', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.click(screen.getByLabelText('Descripción'))
      await user.paste('b'.repeat(2001))

      expect(screen.getByLabelText('Descripción')).toHaveValue('b'.repeat(2000))
    })

    /**
     * Case: team, title and due date are filled in, but the description is empty or only whitespace.
     * Expected: the "Crear tarea" button stays disabled.
     * Result: the button is disabled and createTask is not called.
     */
    it.each(['', '   '])('disables submit when the description is %j', async (description) => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await user.type(screen.getByLabelText('Título'), 'Preparar informe')
      if (description) await user.type(screen.getByLabelText('Descripción'), description)
      fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2099-12-31T10:00' } })

      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
      expect(mockCreateTask).not.toHaveBeenCalled()
    })

    /**
     * Case: team, title and description are filled in, but the due date is empty.
     * Expected: the "Crear tarea" button stays disabled.
     * Result: the button is disabled and createTask is not called.
     */
    it('disables submit when the due date is empty', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await user.type(screen.getByLabelText('Título'), 'Preparar informe')
      await user.type(screen.getByLabelText('Descripción'), 'Informe mensual')

      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
      expect(mockCreateTask).not.toHaveBeenCalled()
    })

    /**
     * Case: the form is rendered.
     * Expected: the description placeholder is not marked as optional and description and due date are required.
     * Result: the placeholder has no "opcional" and both fields have the required attribute.
     */
    it('marks description and due date as required', () => {
      renderWithProviders(<CreateTaskPage />)

      expect(screen.getByLabelText('Descripción')).toHaveAttribute('placeholder', 'Describe qué hay que hacer')
      expect(screen.getByLabelText('Descripción').getAttribute('placeholder')).not.toMatch(/opcional/i)
      expect(screen.getByLabelText('Descripción')).toBeRequired()
      expect(screen.getByLabelText('Fecha límite')).toBeRequired()
    })

    /**
     * Case: all required fields are filled in and there is no responsible.
     * Expected: the button is enabled and the payload carries the trimmed description and the ISO date.
     * Result: createTask receives description, dueDate in ISO and responsibleEmail undefined.
     */
    it('enables submit and sends the trimmed description and ISO date when all required fields are filled', async () => {
      mockCreateTask.mockResolvedValueOnce(createdTask)
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await user.type(screen.getByLabelText('Título'), 'Preparar informe')
      await user.type(screen.getByLabelText('Descripción'), '  Informe mensual  ')
      fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2099-12-31T10:00' } })
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled()
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(mockCreateTask).toHaveBeenCalledWith({
        teamId: 'team-1',
        title: 'Preparar informe',
        description: 'Informe mensual',
        dueDate: new Date('2099-12-31T10:00').toISOString(),
        responsibleEmail: undefined,
      })
    })

    /**
     * Case: 10 characters are typed in the title.
     * Expected: a counter "10/150" is shown under the title and linked to the field.
     * Result: the counter text is rendered and the title has aria-describedby pointing to it.
     */
    it('shows a character counter under the title', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.type(screen.getByLabelText('Título'), '0123456789')

      expect(screen.getByText('10/150')).toBeInTheDocument()
      expect(screen.getByLabelText('Título')).toHaveAttribute('aria-describedby', 'task-title-counter')
      expect(document.getElementById('task-title-counter')).toContainElement(screen.getByText('10/150'))
    })

    /**
     * Case: the title reaches 90 % of its limit (135 characters).
     * Expected: the counter changes to the warning color.
     * Result: the counter has the near-limit class.
     */
    it('warns when the title reaches 90 % of the limit', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.click(screen.getByLabelText('Título'))
      await user.paste('a'.repeat(135))

      expect(document.getElementById('task-title-counter')).toHaveClass('near-limit')
    })

    /**
     * Case: the title reaches its limit (150 characters).
     * Expected: the notice "Llegaste al máximo de 150 caracteres" is shown.
     * Result: the notice is rendered.
     */
    it('shows the limit notice when the title reaches 150 characters', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.click(screen.getByLabelText('Título'))
      await user.paste('a'.repeat(150))

      expect(screen.getByText('Llegaste al máximo de 150 caracteres')).toBeInTheDocument()
    })

    /**
     * Case: the user pastes more than 2000 characters in the description.
     * Expected: the field keeps the first 2000 characters and shows the limit notice.
     * Result: the value has 2000 characters, the counter shows 2000/2000 and the notice appears.
     */
    it('keeps 2000 characters and shows the notice when the description is over the limit', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.click(screen.getByLabelText('Descripción'))
      await user.paste('b'.repeat(2001))

      expect(screen.getByLabelText('Descripción')).toHaveValue('b'.repeat(2000))
      expect(screen.getByText('2000/2000')).toBeInTheDocument()
      expect(screen.getByText('Llegaste al máximo de 2000 caracteres')).toBeInTheDocument()
      expect(screen.getByLabelText('Descripción')).toHaveAttribute('aria-describedby', 'task-description-counter')
    })
  })

  describe('E4 · due date earlier than now', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    function freezeTime() {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-11T10:00:30'))
    }

    /**
     * Case: the current time is 10:00:30.
     * Expected: the due date field does not allow dates before the next minute.
     * Result: the min attribute is "2026-10-11T10:01".
     */
    it('sets the min attribute of the due date to the next minute', () => {
      freezeTime()
      renderWithProviders(<CreateTaskPage />)

      expect(screen.getByLabelText('Fecha límite')).toHaveAttribute('min', '2026-10-11T10:01')
    })

    /**
     * Case: the page stays open for a while and the user focuses the due date field.
     * Expected: the minimum is recalculated with the current time.
     * Result: the min attribute moves to the next minute after focusing.
     */
    it('recalculates the min attribute when the due date field is focused', () => {
      freezeTime()
      renderWithProviders(<CreateTaskPage />)
      vi.setSystemTime(new Date('2026-10-11T10:30:10'))

      fireEvent.focus(screen.getByLabelText('Fecha límite'))

      expect(screen.getByLabelText('Fecha límite')).toHaveAttribute('min', '2026-10-11T10:31')
    })

    /**
     * Case: a past date is typed by hand (min does not prevent typing) with the rest of the fields filled in.
     * Expected: the red message "La fecha límite no puede ser anterior al momento actual" appears under the field, the field is invalid and the button is disabled.
     * Result: the message is rendered, aria-invalid is true, the button is disabled and createTask is not called.
     */
    it('shows the red message, marks the field invalid and disables submit for a past date', async () => {
      freezeTime()
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2026-10-11T09:00' } })

      const message = screen.getByText('La fecha límite no puede ser anterior al momento actual')
      expect(message).toHaveClass('field-error')
      expect(screen.getByLabelText('Fecha límite')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByLabelText('Fecha límite')).toHaveAttribute('aria-describedby', message.id)
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
      expect(mockCreateTask).not.toHaveBeenCalled()
    })

    /**
     * Case: a future date is selected with the rest of the fields filled in.
     * Expected: no message and the button is enabled.
     * Result: no past-date message, aria-invalid false and the button enabled.
     */
    it('shows no message and enables submit for a future date', async () => {
      freezeTime()
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)

      expect(screen.queryByText('La fecha límite no puede ser anterior al momento actual')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Fecha límite')).toHaveAttribute('aria-invalid', 'false')
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeEnabled()
    })

    /**
     * Case: the backend rejects the date (TASK_011) although the form allowed it.
     * Expected: the backend message is shown in a red alert and the task is not created.
     * Result: the alert contains "La fecha límite no puede ser anterior al momento actual" and no success status appears.
     */
    it('shows the backend message when the date is rejected by the server', async () => {
      const { TaskRequestError } = await import('../tasksApi')
      mockCreateTask.mockRejectedValueOnce(new TaskRequestError({ code: 'TASK_011', message: 'La fecha límite no puede ser anterior al momento actual' }))
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent('La fecha límite no puede ser anterior al momento actual')
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  describe('submit button hint', () => {
    function submitWrapper() {
      return screen.getByRole('button', { name: /crear tarea|creando tarea/i }).parentElement as HTMLElement
    }

    /**
     * Case: the form is empty and the user hovers the disabled button.
     * Expected: a tooltip lists only the pending fields: "Para crear la tarea falta: equipo, título, descripción, fecha límite".
     * Result: an element with role tooltip shows that text.
     */
    it('shows a tooltip with the pending fields when hovering the disabled button', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.hover(submitWrapper())

      expect(screen.getByRole('tooltip')).toHaveTextContent('Para crear la tarea falta: equipo, título, descripción, fecha límite')
    })

    /**
     * Case: some fields are filled in and the keyboard user focuses the disabled button wrapper.
     * Expected: the tooltip lists only the fields that are still pending.
     * Result: the tooltip says "Para crear la tarea falta: descripción, fecha límite".
     */
    it('shows only the pending fields on keyboard focus', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)
      await selectTeam(user)
      await user.type(screen.getByLabelText('Título'), 'Preparar informe')

      fireEvent.focus(submitWrapper())

      expect(screen.getByRole('tooltip')).toHaveTextContent('Para crear la tarea falta: descripción, fecha límite')
      expect(submitWrapper()).toHaveAttribute('tabindex', '0')
    })

    /**
     * Case: the due date is before the current moment.
     * Expected: the hint says the date must be later than the current moment.
     * Result: the tooltip includes "la fecha límite debe ser posterior al momento actual".
     */
    it('mentions the past due date in the hint', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      fireEvent.change(screen.getByLabelText('Fecha límite'), { target: { value: '2000-01-01T10:00' } })
      await user.hover(submitWrapper())

      expect(screen.getByRole('tooltip')).toHaveTextContent('la fecha límite debe ser posterior al momento actual')
    })

    /**
     * Case: the coordinator has no teams.
     * Expected: the hint explains that an administrator must assign a team.
     * Result: the tooltip shows "Necesitas un equipo asignado por el Administrador para crear tareas.".
     */
    it('explains the lack of teams in the hint', async () => {
      vi.mocked(getTeams).mockResolvedValue([])
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.hover(submitWrapper())

      await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Necesitas un equipo asignado por el Administrador para crear tareas.'))
    })

    /**
     * Case: all required fields are filled in (enabled button).
     * Expected: no tooltip and no hint text.
     * Result: hovering shows no tooltip and the button has no aria-describedby.
     */
    it('shows no hint when the button is enabled', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await user.hover(submitWrapper())

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /crear tarea/i })).not.toHaveAttribute('aria-describedby')
    })

    /**
     * Case: the task is being sent.
     * Expected: no tooltip while submitting.
     * Result: after clicking create, hovering shows no tooltip.
     */
    it('shows no hint while the task is being sent', async () => {
      mockCreateTask.mockReturnValueOnce(new Promise(() => {}))
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))
      await user.hover(submitWrapper())

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    /**
     * Case: the button is disabled and the device has no hover (touch).
     * Expected: the same text exists as visible text under the button, linked with aria-describedby (the stylesheet shows it on touch and narrow screens).
     * Result: the button points with aria-describedby to a paragraph with the hint text and keeps the disabled attribute.
     */
    it('links the hint text to the disabled button with aria-describedby', async () => {
      renderWithProviders(<CreateTaskPage />)
      await screen.findByRole('option', { name: 'Operaciones' })

      const button = screen.getByRole('button', { name: /crear tarea/i })
      const hintId = button.getAttribute('aria-describedby')
      expect(button).toBeDisabled()
      expect(hintId).toBeTruthy()
      expect(document.getElementById(hintId as string)).toHaveTextContent('Para crear la tarea falta: equipo, título, descripción, fecha límite')
    })
  })

  describe('E5 · invalid responsible', () => {
    /**
     * Case: the responsible does not exist/is inactive, is not a collaborator or belongs to another team.
     * Expected: the task is not created and the matching message is shown in red (role alert).
     * Result: the backend message is rendered in the alert and no success status appears.
     */
    it.each([
      ['TASK_010', 'No se encontró el colaborador responsable indicado'],
      ['TASK_011', 'El responsable de una tarea debe ser un colaborador'],
      ['TASK_012', 'El responsable debe pertenecer al equipo de la tarea'],
    ])('shows the error for %s: "%s"', async (code, message) => {
      const { TaskRequestError } = await import('../tasksApi')
      mockCreateTask.mockRejectedValueOnce(new TaskRequestError({ code, message }))
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await selectResponsible(user, /Luis Pérez/)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    /**
     * Case: creation fails due to permissions (backend error).
     * Expected: the error message is shown.
     * Result: the alert contains "Solo un coordinador".
     */
    it('shows an error message when creation fails', async () => {
      const { TaskRequestError } = await import('../tasksApi')
      mockCreateTask.mockRejectedValueOnce(new TaskRequestError({ code: 'TASK_007', message: 'Solo un coordinador' }))

      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Solo un coordinador')
    })

    /**
     * Case: unhandled error (not a TaskRequestError).
     * Expected: generic message to retry.
     * Result: the alert shows "Ocurrió un error inesperado. Intenta nuevamente."
     */
    it('shows a generic message for unexpected errors', async () => {
      mockCreateTask.mockRejectedValueOnce(new Error('boom'))
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado. Intenta nuevamente.')
    })
  })

  /**
   * HU-12 · selector filtrable de responsable.
   */
  describe('responsible selector', () => {
    /**
     * Case: no team is selected yet.
     * Expected: the field is disabled with "Selecciona primero un equipo" and members are not requested.
     * Result: the input is disabled with that placeholder and getTeamMembers is not called.
     */
    it('is disabled until a team is selected', () => {
      renderWithProviders(<CreateTaskPage />)

      const field = screen.getByLabelText('Responsable (opcional)')
      expect(field).toBeDisabled()
      expect(field).toHaveAttribute('placeholder', 'Selecciona primero un equipo')
      expect(getTeamMembers).not.toHaveBeenCalled()
    })

    /**
     * Case: the user selects a team.
     * Expected: the members of that team are loaded and the field is enabled.
     * Result: getTeamMembers is called with the team id and the field becomes enabled.
     */
    it('loads the team members and enables the field when a team is selected', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)

      expect(getTeamMembers).toHaveBeenCalledWith('team-1', expect.any(AbortSignal))
      await vi.waitFor(() => expect(screen.getByLabelText('Responsable (opcional)')).toBeEnabled())
    })

    /**
     * Case: a responsible is chosen and then the team changes.
     * Expected: the chosen responsible is cleared.
     * Result: the field is empty after changing the team.
     */
    it('clears the responsible when the team changes', async () => {
      vi.mocked(getTeams).mockResolvedValue([
        { id: 'team-1', name: 'Operaciones', coordinatorUserId: 'c1', coordinatorEmail: 'coordinator@compira.co' },
        { id: 'team-2', name: 'Soporte', coordinatorUserId: 'c1', coordinatorEmail: 'coordinator@compira.co' },
      ])
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await selectResponsible(user, /Ana García/)
      expect(screen.getByLabelText('Responsable (opcional)')).toHaveValue('Ana García')
      await user.selectOptions(screen.getByLabelText('Equipo'), 'team-2')

      expect(screen.getByLabelText('Responsable (opcional)')).toHaveValue('')
    })

    /**
     * Case: a responsible is chosen and the task is created.
     * Expected: the responsible is cleared with the rest of the form.
     * Result: the field is empty after the success message.
     */
    it('clears the responsible after creating the task', async () => {
      mockCreateTask.mockResolvedValueOnce({ ...createdTask, responsibleUserId: 'm1' })
      const { user } = renderWithProviders(<CreateTaskPage />)

      await fillRequiredFields(user)
      await selectResponsible(user, /Ana García/)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      await screen.findByRole('status')
      expect(screen.getByLabelText('Responsable (opcional)')).toHaveValue('')
    })

    /**
     * Case: loading the members fails.
     * Expected: an alert with the error is shown, the field stays disabled and the task can still be created without responsible.
     * Result: the alert shows the message, the field is disabled and createTask is called without responsibleEmail.
     */
    it('shows an error and still allows creating the task without responsible when members fail to load', async () => {
      vi.mocked(getTeamMembers).mockRejectedValue(new Error('No se pudieron cargar los colaboradores.'))
      mockCreateTask.mockResolvedValueOnce(createdTask)
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los colaboradores.')
      expect(screen.getByLabelText('Responsable (opcional)')).toBeDisabled()

      await fillTaskFields(user)
      await user.click(screen.getByRole('button', { name: /crear tarea/i }))

      expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ responsibleEmail: undefined }))
    })

    /**
     * Case: loading the members of a team fails and the user then picks another team that loads fine.
     * Expected: the stale error is removed and the field is enabled again.
     * Result: no alert is shown and the field is enabled after changing the team.
     */
    it('removes the members error and re-enables the field when another team loads fine', async () => {
      vi.mocked(getTeams).mockResolvedValue([
        { id: 'team-1', name: 'Operaciones', coordinatorUserId: 'c1', coordinatorEmail: 'coordinator@compira.co' },
        { id: 'team-2', name: 'Soporte', coordinatorUserId: 'c1', coordinatorEmail: 'coordinator@compira.co' },
      ])
      vi.mocked(getTeamMembers).mockRejectedValueOnce(new Error('No se pudieron cargar los colaboradores.'))
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los colaboradores.')
      await user.selectOptions(screen.getByLabelText('Equipo'), 'team-2')

      await vi.waitFor(() => expect(screen.getByLabelText('Responsable (opcional)')).toBeEnabled())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    /**
     * Case: the selected team has no collaborators.
     * Expected: "Este equipo aún no tiene colaboradores. Puedes crear la tarea sin responsable." is shown.
     * Result: the message appears when opening the field.
     */
    it('shows a message when the team has no collaborators', async () => {
      vi.mocked(getTeamMembers).mockResolvedValue([])
      const { user } = renderWithProviders(<CreateTaskPage />)

      await selectTeam(user)
      await vi.waitFor(() => expect(screen.getByLabelText('Responsable (opcional)')).toBeEnabled())
      await user.click(screen.getByLabelText('Responsable (opcional)'))

      expect(screen.getByText('Este equipo aún no tiene colaboradores. Puedes crear la tarea sin responsable.')).toBeInTheDocument()
    })
  })

  describe('E6 · coordinator without an assigned team', () => {
    /**
     * Case: the coordinator has no teams (getTeams returns an empty list).
     * Expected: empty team list, message "Necesitas un equipo asignado por el Administrador para crear tareas." and disabled button.
     * Result: only the placeholder option exists, the message is shown and the button is disabled even with a title.
     */
    it('shows the no-team message and keeps submit disabled', async () => {
      vi.mocked(getTeams).mockResolvedValue([])
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.type(screen.getByLabelText('Título'), 'Preparar informe')

      expect(document.querySelector('.field-hint')).toHaveTextContent('Necesitas un equipo asignado por el Administrador para crear tareas.')
      expect(screen.getAllByRole('option')).toHaveLength(1)
      expect(screen.getByRole('button', { name: /crear tarea/i })).toBeDisabled()
    })

    /**
     * Case: loading teams fails.
     * Expected: the error is reported to the user.
     * Result: the alert shows the error message.
     */
    it('shows an error when teams cannot be loaded', async () => {
      vi.mocked(getTeams).mockRejectedValue(new Error('No se pudieron cargar los equipos.'))
      renderWithProviders(<CreateTaskPage />)

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los equipos.')
    })
  })

  describe('E7 · view tasks', () => {
    /**
     * Case: click on "Ver tareas".
     * Expected: navigates to "Tareas del equipo".
     * Result: navigate is called with '/tasks'.
     */
    it('navigates to the team tasks page', async () => {
      const { user } = renderWithProviders(<CreateTaskPage />)

      await user.click(screen.getByRole('button', { name: 'Ver tareas' }))

      expect(mockNavigate).toHaveBeenCalledWith('/tasks')
    })
  })
})
