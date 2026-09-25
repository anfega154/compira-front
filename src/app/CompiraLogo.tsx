type CompiraLogoProps = {
  variant?: 'full' | 'mark'
  size?: number
  tone?: 'color' | 'light'
  className?: string
}

const GRADIENT_ID = 'compira-logo-gradient'

export function CompiraLogo({
  variant = 'full',
  size = 40,
  tone = 'color',
  className,
}: CompiraLogoProps) {
  const markStartColor = tone === 'light' ? '#ffffff' : '#10b981'
  const markEndColor = tone === 'light' ? '#d1fae5' : '#059669'
  const checkColor = tone === 'light' ? '#059669' : '#ffffff'
  const wordmarkColor = tone === 'light' ? '#ffffff' : '#0f172a'

  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="COMPIRA"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={GRADIENT_ID} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor={markStartColor} />
          <stop offset="1" stopColor={markEndColor} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill={`url(#${GRADIENT_ID})`} />
      <path
        d="M32 16.5a11 11 0 1 0 0 15"
        fill="none"
        stroke={checkColor}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="m19 24 3.6 3.6L31 19"
        fill="none"
        stroke={checkColor}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (variant === 'mark') {
    return <span className={className}>{mark}</span>
  }

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.28 }}
    >
      {mark}
      <span
        style={{
          fontWeight: 700,
          fontSize: size * 0.62,
          letterSpacing: '0.04em',
          color: wordmarkColor,
          lineHeight: 1,
        }}
      >
        COMPIRA
      </span>
    </span>
  )
}
