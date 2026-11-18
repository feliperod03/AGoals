import type { LoginRequest, Usuario } from '@/types/usuario'
import { get, pedirCsrf, post } from './client'

export { pedirCsrf }

/** 200 con el usuario; 401 «Email o contraseña incorrectos»; 429 si el freno de intentos bloquea. */
export function login(request: LoginRequest): Promise<Usuario> {
  return post<Usuario>('/api/auth/login', request)
}

/** 204. Borra el recordarme de este dispositivo y cierra la sesión. */
export function logout(): Promise<void> {
  return post<void>('/api/auth/logout')
}

/** El usuario de la sesión, o `ApiError` 401 si no hay (con recordarme vigente la petición autentica sola). */
export function yo(): Promise<Usuario> {
  return get<Usuario>('/api/auth/yo')
}
