// Los diálogos se abren por estado, no con un `DialogTrigger`; `dialog.tsx` devuelve el foco a lo que lo tenía al
// abrirse. Desde un menú «⋯» eso sería el ítem, que se desmonta al cerrar el menú. Para ese caso, el ítem deja aquí
// el botón del menú y el diálogo lo recoge una sola vez.

let registrado: HTMLElement | null = null
let limpieza: ReturnType<typeof setTimeout> | undefined

/**
 * Un ítem de menú dejó su botón como lugar de retorno del foco. Solo vale para el diálogo que se monte como
 * consecuencia de esa selección (se monta en el mismo ciclo de eventos); si el ítem no abre ninguno, se olvida
 * en el siguiente, para que no lo herede un diálogo abierto después desde otro sitio.
 */
export function recordarDisparador(elemento: HTMLElement | null) {
  clearTimeout(limpieza)
  registrado = elemento
  limpieza = setTimeout(() => {
    registrado = null
  }, 0)
}

/** Devuelve el disparador recordado y lo olvida: sirve una sola vez. */
export function tomarDisparador(): HTMLElement | null {
  const actual = registrado
  registrado = null
  clearTimeout(limpieza)
  return actual
}
