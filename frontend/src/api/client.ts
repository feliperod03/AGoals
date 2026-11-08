import type { ErrorApi } from '@/types/api'

// Único lugar del frontend que llama a `fetch`. Rutas relativas (/api/...): en
// desarrollo las atiende el proxy de Vite.

/** Error de la API con un mensaje ya listo para mostrar al usuario. `status` 0 = sin conexión. */
export class ApiError extends Error {
  readonly status: number
  readonly errores: string[]

  constructor(status: number, mensaje: string, errores: string[] = []) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
    this.errores = errores
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>

interface Opciones {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  body?: unknown
}

export function get<T>(path: string, query?: Query): Promise<T> {
  return request<T>(path, { query })
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body })
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PUT', body })
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body })
}

export function del(path: string): Promise<void> {
  return request<void>(path, { method: 'DELETE' })
}

async function request<T>(path: string, { method = 'GET', query, body }: Opciones): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(construirUrl(path, query), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa que el backend esté en marcha.')
  }

  const texto = await respuesta.text()

  if (!respuesta.ok) {
    throw errorDeRespuesta(respuesta.status, texto)
  }
  // 204 (DELETE) y cualquier respuesta sin cuerpo.
  if (texto === '') {
    return undefined as T
  }
  try {
    return JSON.parse(texto) as T
  } catch {
    throw new ApiError(respuesta.status, 'El servidor respondió algo que no se pudo leer.')
  }
}

function construirUrl(path: string, query?: Query): string {
  // URLSearchParams codifica el '+' del desfase horario como %2B.
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== null && valor !== undefined) {
      params.set(clave, String(valor))
    }
  }
  const cadena = params.toString()
  return cadena === '' ? path : `${path}?${cadena}`
}

/**
 * Arma el mensaje de un error HTTP. El cuerpo puede venir vacío o no ser JSON
 * (p. ej. un 400 sin cuerpo por un enum inválido, o un 5xx de un proxy): en ese
 * caso se usa un mensaje genérico según el status.
 */
function errorDeRespuesta(status: number, texto: string): ApiError {
  const cuerpo = leerCuerpoDeError(texto)
  if (cuerpo) {
    const detalle = cuerpo.errores.length > 0 ? `: ${cuerpo.errores.join('; ')}` : ''
    return new ApiError(status, cuerpo.mensaje + detalle, cuerpo.errores)
  }
  return new ApiError(status, mensajeGenerico(status))
}

function leerCuerpoDeError(texto: string): ErrorApi | null {
  if (texto === '') return null
  try {
    const dato: unknown = JSON.parse(texto)
    if (typeof dato === 'object' && dato !== null && 'mensaje' in dato && typeof dato.mensaje === 'string') {
      const errores = 'errores' in dato && Array.isArray(dato.errores) ? dato.errores.map(String) : []
      return { mensaje: dato.mensaje, errores }
    }
  } catch {
    // No era JSON: se ignora.
  }
  return null
}

function mensajeGenerico(status: number): string {
  if (status === 400) return 'La solicitud no es válida.'
  if (status === 404) return 'No se encontró lo que buscabas.'
  if (status === 409) return 'La acción choca con el estado actual de los datos.'
  if (status >= 500) return `Error del servidor (${status}). Inténtalo de nuevo más tarde.`
  return `Error inesperado (${status}).`
}
