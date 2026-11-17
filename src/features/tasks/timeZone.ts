export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function formatTimeZoneLabel(zone: string, date: Date): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(date)
  const raw = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT'
  const offset = raw === 'GMT' ? '+00:00' : raw.replace('GMT', '').replace('-', '−')
  return `${zone} (UTC${offset})`
}
