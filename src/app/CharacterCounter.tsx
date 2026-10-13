type CharacterCounterProps = {
  id: string
  length: number
  max: number
}

const WARNING_RATIO = 0.9

export function CharacterCounter({ id, length, max }: CharacterCounterProps) {
  const isNearLimit = length >= max * WARNING_RATIO
  const isAtLimit = length >= max

  return (
    <div id={id} className={`char-counter${isNearLimit ? ' near-limit' : ''}`}>
      <span className="char-counter-notice" aria-live="polite">
        {isAtLimit ? `Llegaste al máximo de ${max} caracteres` : ''}
      </span>
      <span className="char-counter-count">{length}/{max}</span>
    </div>
  )
}
