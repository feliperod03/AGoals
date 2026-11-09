import { ANCLADOS_POR_DEFECTO, MAX_ANCLADOS, PRESETS, type PresetId } from './filtros'

export const CLAVE_ANCLADOS = 'agoals:cofre:anclados'

const IDS_CONOCIDOS = new Set<string>(PRESETS.map((p) => p.id))

/** Valida lo leído: arreglo de ids conocidos, sin repetidos y como mucho `MAX_ANCLADOS`. Si no, `null`. */
function validar(valor: unknown): PresetId[] | null {
  if (!Array.isArray(valor) || valor.length > MAX_ANCLADOS) return null
  if (!valor.every((v) => typeof v === 'string' && IDS_CONOCIDOS.has(v))) return null
  if (new Set(valor).size !== valor.length) return null
  return valor as PresetId[]
}

/** Accesos rápidos guardados; ante cualquier problema (nada, JSON roto, ids raros, sin acceso) usa los de fábrica. `[]` es válido. */
export function leerAnclados(): PresetId[] {
  try {
    const texto = localStorage.getItem(CLAVE_ANCLADOS)
    if (texto === null) return [...ANCLADOS_POR_DEFECTO]
    return validar(JSON.parse(texto)) ?? [...ANCLADOS_POR_DEFECTO]
  } catch {
    return [...ANCLADOS_POR_DEFECTO]
  }
}

/** Guarda los accesos rápidos. Si el navegador no deja escribir, se sigue con lo que hay en memoria. */
export function guardarAnclados(ids: PresetId[]): void {
  try {
    localStorage.setItem(CLAVE_ANCLADOS, JSON.stringify(ids))
  } catch {
    // Sin almacenamiento disponible: los accesos rápidos valen solo mientras la página siga abierta.
  }
}
