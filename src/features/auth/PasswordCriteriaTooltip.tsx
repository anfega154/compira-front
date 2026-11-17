type PasswordCriteriaTooltipProps = {
  password: string
  visible: boolean
}

export function PasswordCriteriaTooltip({ password, visible }: PasswordCriteriaTooltipProps) {
  if (!visible) return null

  const criteria = [
    { label: 'Minimo 10 caracteres', met: password.length >= 10 },
    { label: 'Al menos una letra mayuscula', met: /[A-Z]/.test(password) },
    { label: 'Al menos una letra minuscula', met: /[a-z]/.test(password) },
    { label: 'Al menos un numero', met: /\d/.test(password) },
    { label: 'Al menos un caracter especial (!@#$%^&*)', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ]

  return (
    <div className="password-criteria-tooltip" role="tooltip" aria-label="Criterios de contrasena">
      <p className="password-criteria-title">La contrasena debe cumplir:</p>
      <ul className="password-criteria-list">
        {criteria.map((criterion) => (
          <li key={criterion.label} className={criterion.met ? 'met' : ''}>
            <span className="criteria-icon" aria-hidden="true">{criterion.met ? '✓' : '○'}</span>
            {criterion.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
