// Foco de respaldo: cuando el botón «⋯» que abrió un diálogo desaparece (la fila cambió de lista o se borró), el foco
// cae a <body> y quien navega con teclado tiene que volver a tabular desde la barra lateral. Cada página marca su
// encabezado con `data-foco-respaldo` (y `tabIndex={-1}`) y aquí se le lleva el foco. No toca `retornoFoco.ts`.

/** Atributo que marca el elemento de respaldo de la página. */
export const ATRIBUTO_RESPALDO = 'data-foco-respaldo'

/**
 * Si el foco quedó en <body> (o en un elemento que ya no está en el documento), lo lleva al elemento marcado con
 * `data-foco-respaldo`. Sin marca, o con el foco ya en otro sitio, no hace nada. `preventScroll`: la página no salta
 * al encabezado.
 */
export function enfocarRespaldo() {
  const activo = document.activeElement
  if (activo && activo !== document.body && activo.isConnected) return
  document.querySelector<HTMLElement>(`[${ATRIBUTO_RESPALDO}]`)?.focus({ preventScroll: true })
}

/** Igual que `enfocarRespaldo`, pero tras el siguiente ciclo de eventos (cuando el DOM ya refleja la lista refrescada y Radix terminó de devolver el foco). */
export function enfocarRespaldoDespues() {
  setTimeout(enfocarRespaldo, 0)
}

/**
 * Valor de `atributo` del vecino del elemento con ese valor entre todos los `[atributo]` del documento: el siguiente o,
 * si era el último, el anterior. `null` si no hay otro. Se calcula ANTES de la acción, cuando la fila aún existe.
 */
export function vecinoDe(atributo: string, valor: string | number): string | null {
  const todos = Array.from(document.querySelectorAll<HTMLElement>(`[${atributo}]`))
  const i = todos.findIndex((el) => el.getAttribute(atributo) === String(valor))
  if (i === -1) return null
  const vecino = todos[i + 1] ?? todos[i - 1]
  return vecino?.getAttribute(atributo) ?? null
}

/** Cuántas veces se reintenta (cada `ESPERA_MS`) mientras el destino existe pero sigue deshabilitado (mutación terminando). */
const REINTENTOS = 20
const ESPERA_MS = 25

/**
 * Tras el siguiente ciclo de eventos enfoca el primer selector que exista. Si ese elemento sigue deshabilitado (el botón
 * se rehabilita cuando React termina de aplicar el fin de la mutación, un poco después de `onSuccess`), reintenta unos
 * instantes en vez de saltarlo; si no llega a habilitarse, o ningún selector existe, cae al encabezado de respaldo.
 * Sin `preventScroll`: el elemento destino debe quedar a la vista.
 */
export function enfocarDespues(selectores: Array<string | null | undefined>) {
  function intentar(restantes: number) {
    for (const s of selectores) {
      if (!s) continue
      const el = document.querySelector<HTMLElement>(s)
      if (!el) continue
      if (!(el as HTMLButtonElement).disabled) {
        el.focus()
        return
      }
      if (restantes > 0) {
        setTimeout(() => intentar(restantes - 1), ESPERA_MS)
        return
      }
    }
    enfocarRespaldo()
  }
  setTimeout(() => intentar(REINTENTOS), 0)
}
