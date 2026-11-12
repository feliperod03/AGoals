export type Preferencia = 'sistema' | 'claro' | 'oscuro'

export const CLAVE_TEMA = 'agoals:tema'

/** Orden del botón: cada clic pasa a la siguiente. */
export const ORDEN_PREFERENCIAS: readonly Preferencia[] = ['sistema', 'claro', 'oscuro']

/**
 * Preferencia guardada. Solo `claro` y `oscuro` se guardan: sin nada (o con un valor raro, o sin acceso al
 * almacenamiento) se sigue al sistema.
 * OJO: el script inline de `index.html` aplica la misma lógica antes de pintar; si cambia esto, cambia allí
 * (un test los compara).
 */
export function leerPreferencia(): Preferencia {
  try {
    const valor = localStorage.getItem(CLAVE_TEMA)
    return valor === 'claro' || valor === 'oscuro' ? valor : 'sistema'
  } catch {
    return 'sistema'
  }
}

/** Guarda la elección; `sistema` borra la clave. Si el navegador no deja escribir, la elección vale mientras la página siga abierta. */
export function guardarPreferencia(preferencia: Preferencia): void {
  try {
    if (preferencia === 'sistema') localStorage.removeItem(CLAVE_TEMA)
    else localStorage.setItem(CLAVE_TEMA, preferencia)
  } catch {
    // Sin almacenamiento disponible: se sigue con lo que hay en memoria.
  }
}

export function esOscuro(preferencia: Preferencia, sistemaOscuro: boolean): boolean {
  return preferencia === 'sistema' ? sistemaOscuro : preferencia === 'oscuro'
}

export function siguientePreferencia(actual: Preferencia): Preferencia {
  return ORDEN_PREFERENCIAS[(ORDEN_PREFERENCIAS.indexOf(actual) + 1) % ORDEN_PREFERENCIAS.length] as Preferencia
}
