/** Usuario de la sesión (`UsuarioResponse` del backend). */
export interface Usuario {
  id: number
  nombreUsuario: string
  email: string
}

/** Cuerpo de `POST /api/auth/login`. El campo se llama `clave` en el JSON; en pantalla siempre «contraseña». */
export interface LoginRequest {
  email: string
  clave: string
  recordarme: boolean
}
