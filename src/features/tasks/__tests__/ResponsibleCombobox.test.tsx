import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TeamMember } from '../../teams/teamsApi'
import { ResponsibleCombobox } from '../ResponsibleCombobox'

const members: TeamMember[] = [
  { id: 'm1', email: 'ana@compira.co', firstName: 'Ana', lastName: 'García' },
  { id: 'm2', email: 'colab.b@compira.co', firstName: 'José', lastName: 'Colab' },
  { id: 'm3', email: 'sin.nombre@compira.co', firstName: null, lastName: null },
]

function setup(props: Partial<React.ComponentProps<typeof ResponsibleCombobox>> = {}) {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<ResponsibleCombobox id="responsible" members={members} value="" onChange={onChange} {...props} />)
  return { user, onChange, input: screen.getByRole('combobox') }
}

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

/**
 * HU-12 · selector de responsable.
 * Cada prueba documenta: Case (escenario), Expected (comportamiento requerido) y Result (lo que se verifica).
 */
describe('ResponsibleCombobox', () => {
  /**
   * Case: the user focuses the field without typing.
   * Expected: the full list of team collaborators is shown.
   * Result: one option per member is rendered.
   */
  it('shows every member when focused', async () => {
    const { user, input } = setup()

    await user.click(input)

    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  /**
   * Case: the user types "colab".
   * Expected: the list is filtered by name or email.
   * Result: only the member whose name/email contains the text remains.
   */
  it('filters by name or email while typing', async () => {
    const { user, input } = setup()

    await user.type(input, 'colab')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('colab.b@compira.co')
  })

  /**
   * Case: the user types "jose" and the member is named "José".
   * Expected: the filter ignores accents and letter case.
   * Result: the member is found.
   */
  it('ignores accents and case when filtering', async () => {
    const { user, input } = setup()

    await user.type(input, 'JOSE')

    expect(screen.getByRole('option', { name: /José Colab/ })).toBeInTheDocument()
  })

  /**
   * Case: an option is rendered.
   * Expected: it shows initials, full name and email.
   * Result: the option contains "AG", "Ana García" and "ana@compira.co".
   */
  it('shows initials, full name and email in each option', async () => {
    const { user, input } = setup()

    await user.click(input)

    const option = screen.getAllByRole('option')[0]
    expect(option).toHaveTextContent('AG')
    expect(option).toHaveTextContent('Ana García')
    expect(option).toHaveTextContent('ana@compira.co')
  })

  /**
   * Case: a member without first and last name.
   * Expected: the email is used as name and the first letter as initial.
   * Result: the option shows "S" and the email as name.
   */
  it('falls back to the email when the member has no name', async () => {
    const { user, input } = setup()

    await user.click(input)

    const option = screen.getAllByRole('option')[2]
    expect(option).toHaveTextContent('S')
    expect(option.querySelector('.combobox-name')).toHaveTextContent('sin.nombre@compira.co')
  })

  /**
   * Case: the typed text matches no member.
   * Expected: the message "Ningún colaborador del equipo coincide con "<texto>"" is shown.
   * Result: the message is rendered and there are no options.
   */
  it('shows a message when no member matches the filter', async () => {
    const { user, input } = setup()

    await user.type(input, 'zzz')

    expect(screen.getByText('Ningún colaborador del equipo coincide con "zzz"')).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  /**
   * Case: the team has no collaborators.
   * Expected: "Este equipo aún no tiene colaboradores. Puedes crear la tarea sin responsable." is shown.
   * Result: the message is rendered.
   */
  it('shows a message when the team has no collaborators', async () => {
    const { user, input } = setup({ members: [] })

    await user.click(input)

    expect(screen.getByText('Este equipo aún no tiene colaboradores. Puedes crear la tarea sin responsable.')).toBeInTheDocument()
  })

  /**
   * Case: the user clicks an option.
   * Expected: the email of that member is selected and the list closes.
   * Result: onChange is called with the email and the listbox disappears.
   */
  it('selects a member on click and closes the list', async () => {
    const { user, input, onChange } = setup()

    await user.click(input)
    await user.click(screen.getByRole('option', { name: /Ana García/ }))

    expect(onChange).toHaveBeenCalledWith('ana@compira.co')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  /**
   * Case: a member is selected and the user clicks the ✕ button.
   * Expected: the selection is removed.
   * Result: the input shows the member name and onChange is called with an empty string.
   */
  it('clears the selection with the remove button', async () => {
    const { user, input, onChange } = setup({ value: 'ana@compira.co' })

    expect(input).toHaveValue('Ana García')
    await user.click(screen.getByRole('button', { name: 'Quitar responsable' }))

    expect(onChange).toHaveBeenCalledWith('')
  })

  /**
   * Case: the list is open, the user presses ↓ once (first option is active by default) and Enter.
   * Expected: the second option is selected.
   * Result: onChange is called with the email of the second member.
   */
  it('selects the second option with the keyboard (ArrowDown, Enter)', async () => {
    const { user, input, onChange } = setup()

    await user.click(input)
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith('colab.b@compira.co')
  })

  /**
   * Case: the list is open, the user presses ↓ twice and ↑ once, then Enter.
   * Expected: the active option moves down and up and Enter selects the active one.
   * Result: onChange is called with the email of the second member.
   */
  it('moves the active option up with ArrowUp', async () => {
    const { user, input, onChange } = setup()

    await user.click(input)
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}')

    expect(onChange).toHaveBeenCalledWith('colab.b@compira.co')
  })

  /**
   * Case: the list is closed and the user presses ↑.
   * Expected: the list opens, like with ↓.
   * Result: the listbox appears.
   */
  it('opens the list with ArrowUp when it is closed', async () => {
    const { user, input } = setup()

    input.focus()
    await user.keyboard('{Escape}{ArrowUp}')

    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  /**
   * Case: no member matches and the user presses ↓.
   * Expected: the active index stays valid and no option is selected on Enter.
   * Result: the empty-state message remains and onChange is not called.
   */
  it('keeps a valid active index when the filtered list is empty', async () => {
    const { user, input, onChange } = setup()

    await user.type(input, 'zzz')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByText('Ningún colaborador del equipo coincide con "zzz"')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  /**
   * Case: the list is open and the user presses Tab.
   * Expected: the list closes without selecting any option.
   * Result: the listbox disappears and onChange is not called.
   */
  it('closes with Tab without selecting', async () => {
    const { user, input, onChange } = setup()

    await user.click(input)
    await user.tab()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  /**
   * Case: the list is open and the user presses Escape.
   * Expected: the list closes without changing the value.
   * Result: the listbox disappears and onChange is not called.
   */
  it('closes with Escape without changing the value', async () => {
    const { user, input, onChange } = setup()

    await user.click(input)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  /**
   * Case: ARIA semantics of the field.
   * Expected: role combobox with aria-expanded, options with aria-selected.
   * Result: aria-expanded switches false → true and only the selected option has aria-selected=true.
   */
  it('exposes combobox, listbox and option ARIA attributes', async () => {
    const { user, input } = setup({ value: 'ana@compira.co' })

    expect(input).toHaveAttribute('aria-expanded', 'false')
    await user.click(input)

    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id)
    expect(screen.getByRole('option', { name: /Ana García/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: /José Colab/ })).toHaveAttribute('aria-selected', 'false')
  })

  /**
   * Case: the field is disabled (no team selected).
   * Expected: the list does not open.
   * Result: the input is disabled, shows the placeholder and no listbox appears.
   */
  it('does not open when disabled', async () => {
    const { user, input } = setup({ disabled: true, placeholder: 'Selecciona primero un equipo' })

    await user.click(input)

    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('placeholder', 'Selecciona primero un equipo')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  /**
   * Case: the list is opened on a small screen (max-width 640 px).
   * Expected: the field scrolls into view so the keyboard does not cover the list.
   * Result: scrollIntoView is called on the input.
   */
  it('scrolls the field into view when opened on a small screen', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 640px)', media: query }))
    const { user, input } = setup()

    await user.click(input)

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' })
  })

  /**
   * Case: the list is opened on a wide screen.
   * Expected: the page is not scrolled.
   * Result: scrollIntoView is not called.
   */
  it('does not scroll the field on wide screens', async () => {
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }))
    const { user, input } = setup()

    await user.click(input)

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  /**
   * Case: the members are being loaded.
   * Expected: the field is disabled and shows "Cargando colaboradores…".
   * Result: the input is disabled with the loading placeholder.
   */
  it('shows the loading state', () => {
    const { input } = setup({ isLoading: true })

    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('placeholder', 'Cargando colaboradores…')
  })
})
