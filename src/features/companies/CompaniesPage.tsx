import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createCompany, getCompanies } from './companyApi'
import type { Company } from './types'

const initialForm = {
  name: '',
  email: '',
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    void loadCompanies()
  }, [])

  const totalCompanies = useMemo(() => companies.length, [companies])

  async function loadCompanies() {
    try {
      setLoading(true)
      setError(null)
      const data = await getCompanies()
      setCompanies(data)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const company = await createCompany(form)
      setCompanies((currentCompanies) => [company, ...currentCompanies])
      setForm(initialForm)
      setSuccess(`Empresa ${company.name} creada correctamente`)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Panel principal</p>
          <h2>Empresas</h2>
          <p className="page-copy">
            Administra las empresas registradas en la plataforma COMPIRA.
          </p>
        </div>

        <div className="metric-card">
          <span>Total empresas</span>
          <strong>{totalCompanies}</strong>
        </div>
      </header>

      <div className="grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Registrar empresa</h3>
              <p>Agrega una nueva empresa a la plataforma.</p>
            </div>
          </div>

          <form className="company-form" onSubmit={handleSubmit}>
            <label>
              Nombre
              <input
                required
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Compira SAS"
              />
            </label>

            <label>
              Correo
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="contacto@compira.co"
              />
            </label>

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear empresa'}
            </button>
          </form>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h3>Empresas registradas</h3>
              <p>Consulta el listado de empresas de la organizacion.</p>
            </div>

            <button className="secondary-button" type="button" onClick={() => void loadCompanies()} disabled={loading}>
              {loading ? 'Consultando...' : 'Recargar'}
            </button>
          </div>

          {error ? <div className="feedback error">{error}</div> : null}
          {success ? <div className="feedback success">{success}</div> : null}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {!loading && companies.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      Todavía no hay empresas registradas.
                    </td>
                  </tr>
                ) : null}

                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td>{company.email}</td>
                    <td>{new Date(company.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Ocurrió un error inesperado'
}
