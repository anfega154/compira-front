const EMAIL_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/
export const INVALID_EMAIL_MESSAGE = 'El correo electrónico no tiene un formato válido'

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email) && email.split('@')[0].length <= 64
}
