import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { getOrganizationSettings, saveOrganizationSettings } from './organizationApi'
import type { OrganizationSettings } from './organizationApi'

const TIME_ZONES = [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])].sort()

export function OrganizationSettingsPage() {
  const { user } = useAuth()
  return user?.roles.includes('ADMINISTRATOR') ? <SettingsForm /> : <p role="alert">Solo el Administrador puede configurar la organización.</p>
}

function SettingsForm() {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getOrganizationSettings(controller.signal).then(configuration => {
      if (!controller.signal.aborted) setSettings(configuration)
    }).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'No se pudo cargar la configuración.')
    })
    return () => controller.abort()
  }, [attempt])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!settings?.timeZone || isSaving) return
    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      setSettings(await saveOrganizationSettings(settings))
      setSuccess('Configuración guardada.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo guardar la configuración.')
    } finally {
      setIsSaving(false)
    }
  }

  return <section className="page organization-settings">
    <header className="page-header"><div><p className="eyebrow">Administración</p><h2>Configuración de la organización</h2>
      <p className="page-copy">Una zona horaria y un interruptor de notificaciones para toda la organización.</p></div></header>
    <article className="panel">
      {error && <p className="feedback error" role="alert">{error}</p>}
      {!settings && (error ? <button type="button" className="secondary-button" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Reintentar</button> : <p role="status">Cargando configuración…</p>)}
      {settings && <form className="register-user-form" onSubmit={handleSubmit}>
        {settings.timeZone === null && <p>Selecciona la zona horaria antes de activar las alertas.</p>}
        <div className="task-form-field"><label htmlFor="organization-time-zone">Zona horaria global</label>
          <select id="organization-time-zone" required value={settings.timeZone ?? ''} disabled={isSaving}
            onChange={event => { setSettings({ ...settings, timeZone: event.target.value }); setSuccess('') }}>
            <option value="">Selecciona una zona horaria</option>
            {settings.timeZone && !TIME_ZONES.includes(settings.timeZone) && <option>{settings.timeZone}</option>}
            {TIME_ZONES.map(zone => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
          </select></div>
        <label className="notification-toggle"><input type="checkbox" checked={settings.notificationsEnabled} disabled={isSaving}
          onChange={event => { setSettings({ ...settings, notificationsEnabled: event.target.checked }); setSuccess('') }} />Notificaciones activas</label>
        <p className="page-copy">Los avisos de próxima a vencer se generan 24 horas antes. No se envían correos ni notificaciones push.</p>
        <button className="primary-button" disabled={isSaving || !settings.timeZone}>{isSaving ? 'Guardando…' : 'Guardar configuración'}</button>
        {success && <p className="feedback success" role="status">{success}</p>}
      </form>}
    </article>
  </section>
}
