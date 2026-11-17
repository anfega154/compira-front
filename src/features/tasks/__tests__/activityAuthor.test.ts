import { expect, it } from 'vitest'
import { formatActivityAuthor } from '../taskLabels'

it.each([
  [null, null, null, 'Sistema (automático)'],
  ['user-1', 'Ana García', 'ana@example.test', 'Ana García (ana@example.test)'],
  ['user-1', null, 'ana@example.test', 'ana@example.test'],
  ['user-1', ' Ana García ', null, 'Ana García'],
  ['legacy', null, null, 'Usuario no disponible'],
])('formats the activity author without inventing an identity', (id, name, email, expected) => {
  expect(formatActivityAuthor(id, name, email)).toBe(expected)
})
