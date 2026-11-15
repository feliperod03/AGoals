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
