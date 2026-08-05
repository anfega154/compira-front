import type { Company, CreateCompanyPayload } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(errorBody || 'No fue posible completar la solicitud')
  }

  return response.json() as Promise<T>
}

export async function getCompanies(): Promise<Company[]> {
  const response = await fetch(`${API_URL}/companies`)
  return handleResponse<Company[]>(response)
}

export async function createCompany(payload: CreateCompanyPayload): Promise<Company> {
  const response = await fetch(`${API_URL}/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return handleResponse<Company>(response)
}
