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

export function del(path: string, query?: Query): Promise<void> {
  return request<void>(path, { method: 'DELETE', query })
}

const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Revisa que el backend esté en marcha.'

// --- CSRF ---------------------------------------------------------------------------------------
// Toda escritura lleva la cabecera X-XSRF-TOKEN con el valor de la cookie XSRF-TOKEN. El login y el
// logout renuevan esa cookie, así que se lee en CADA petición y nunca se guarda.

const COOKIE_CSRF = 'XSRF-TOKEN'
const CABECERA_CSRF = 'X-XSRF-TOKEN'
const RUTA_CSRF = '/api/auth/csrf'

function leerCookie(nombre: string): string | null {
  for (const parte of document.cookie.split(';')) {
    const i = parte.indexOf('=')
    if (i < 0 || parte.slice(0, i).trim() !== nombre) continue
    const valor = parte.slice(i + 1).trim()
    if (valor === '') return null
    try {
      return decodeURIComponent(valor)
    } catch {
      return valor
    }
  }
  return null
}

let csrfEnCurso: Promise<void> | null = null

/**
 * Pide al servidor que deje la cookie XSRF-TOKEN (GET /api/auth/csrf, 204). Las llamadas simultáneas
 * comparten una sola petición; la promesa compartida se libera al resolverse O fallar, para que un
 * fallo no bloquee las escrituras siguientes.
 */
export function pedirCsrf(): Promise<void> {
  if (csrfEnCurso) return csrfEnCurso
  const promesa = (async () => {
    let respuesta: Response
    try {
      respuesta = await fetch(RUTA_CSRF, { method: 'GET' })
    } catch {
      throw new ApiError(0, MENSAJE_SIN_CONEXION)
    }
    if (!respuesta.ok) {
      throw errorDeRespuesta(respuesta.status, await respuesta.text())
    }
  })()
  csrfEnCurso = promesa
  // `then` con dos manejadores: libera en ambos casos y no deja un rechazo sin atender.
  const liberar = () => {
    if (csrfEnCurso === promesa) csrfEnCurso = null
  }
  promesa.then(liberar, liberar)
  return promesa
}

// --- Sesión perdida -----------------------------------------------------------------------------
// `api/` no conoce la app: quien quiera enterarse de un 401 se registra aquí (lo hace VigiaSesion).

type OyentePerdidaDeSesion = () => void
const oyentesSesion = new Set<OyentePerdidaDeSesion>()

/** Registra un oyente para los 401 de cualquier petición que no sea de `/api/auth/*`. Devuelve cómo darlo de baja. */
export function alPerderSesion(oyente: OyentePerdidaDeSesion): () => void {
  oyentesSesion.add(oyente)
  return () => {
    oyentesSesion.delete(oyente)
  }
}

function avisarSesionPerdida() {
  for (const oyente of [...oyentesSesion]) oyente()
}

// --- Petición -----------------------------------------------------------------------------------

async function enviar(url: string, method: string, cuerpo: string | undefined, esEscritura: boolean): Promise<Response> {
  const headers: Record<string, string> = {}
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (esEscritura) {
    const token = leerCookie(COOKIE_CSRF)
    if (token !== null) headers[CABECERA_CSRF] = token
  }
  try {
    return await fetch(url, {
      method,
      headers: Object.keys(headers).length === 0 ? undefined : headers,
      body: cuerpo,
    })
  } catch {
    throw new ApiError(0, MENSAJE_SIN_CONEXION)
  }
}

async function request<T>(path: string, { method = 'GET', query, body }: Opciones): Promise<T> {
  const url = construirUrl(path, query)
  const cuerpo = body === undefined ? undefined : JSON.stringify(body)
  const esEscritura = method !== 'GET'

  if (esEscritura && leerCookie(COOKIE_CSRF) === null) {
    await pedirCsrf()
  }
  let respuesta = await enviar(url, method, cuerpo, esEscritura)
  // Hoy el backend solo responde 403 por CSRF: se renueva el token y se reintenta UNA vez.
  if (esEscritura && respuesta.status === 403) {
    await pedirCsrf()
    respuesta = await enviar(url, method, cuerpo, esEscritura)
  }

  const texto = await respuesta.text()

  if (!respuesta.ok) {
    // Los 401 de /api/auth/* (login con clave mala, /yo sin sesión) los maneja quien los llama.
    if (respuesta.status === 401 && !path.startsWith('/api/auth/')) {
      avisarSesionPerdida()
    }
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
