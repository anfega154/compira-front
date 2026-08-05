export type Company = {
  id: string
  name: string
  email: string
  createdAt: string
}

export type CreateCompanyPayload = {
  name: string
  email: string
}
