export const API_KEY_TYPES = {
  ADMIN: 'admin',
  CLIENT: 'client',
} as const

export type ApiKeyType = (typeof API_KEY_TYPES)[keyof typeof API_KEY_TYPES]
