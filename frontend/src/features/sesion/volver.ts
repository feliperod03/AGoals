/**
 * Destino al que volver tras entrar (`/login?volver=…`). Solo se aceptan rutas internas: empiezan con «/»
 * y no con «//» ni «/\» (el navegador trata la barra invertida como «/» y saltaría a otro sitio), sin
 * caracteres de control y sin apuntar de nuevo a /login. Cualquier otra cosa vale «/».
 */
export function volverSeguro(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.startsWith('/\\')) return '/'
  for (const caracter of valor) {
    const codigo = caracter.charCodeAt(0)
    if (codigo < 0x20 || codigo === 0x7f) return '/'
  }
  if (/^\/login(?:[/?#]|$)/.test(valor)) return '/'
  return valor
}

/** Ruta completa (ruta, búsqueda y ancla) de una ubicación del router. */
export function rutaParaVolver(ubicacion: { pathname: string; search: string; hash: string }): string {
  return ubicacion.pathname + ubicacion.search + ubicacion.hash
}

/** `/login` con `volver`; desde la raíz no hace falta (es el destino por defecto). */
export function urlLogin(ruta: string): string {
  return ruta === '/' ? '/login' : `/login?volver=${encodeURIComponent(ruta)}`
}
