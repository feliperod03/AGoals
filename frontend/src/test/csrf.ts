/** Cookie CSRF de prueba. Sin ella, cada escritura del cliente real haría antes un GET /api/auth/csrf. */
export const TOKEN_CSRF_PRUEBA = 'token-csrf-de-prueba'

/** Fija la cookie `XSRF-TOKEN` de jsdom; `null` la borra. */
export function fijarCookieCsrf(valor: string | null) {
  document.cookie =
    valor === null ? 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' : `XSRF-TOKEN=${encodeURIComponent(valor)}; path=/`
}
