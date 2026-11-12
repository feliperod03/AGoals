import type { RefObject } from 'react'

import { BorrarEventoDialog } from './BorrarEventoDialog'
import { EventoDialog } from './EventoDialog'
import type { AccionesEvento } from './useAccionesEvento'

/**
 * Los dos diálogos de eventos, montados una vez por página (como `DialogosAcciones` y `DialogosIdeas`).
 *
 * Foco al cerrar la edición: el `Dialog` de Radix solo lo devuelve a su `DialogTrigger`, y estos diálogos son
 * controlados (no tienen trigger), así que lo devolvemos a mano al elemento que lo tenía al abrir (el bloque, la fila,
 * la celda del día o «Nuevo evento»). Si ese elemento ya no está en la página (se borró el evento, o se movió de día y
 * su bloque se volvió a montar) o era el `body` (un clic en un hueco no enfoca nada), va a `focoAlternativo`.
 */
export function DialogosEvento({ acciones, focoAlternativo }: { acciones: AccionesEvento; focoAlternativo: RefObject<HTMLElement | null> }) {
  function alCerrarFoco(evento: Event) {
    evento.preventDefault()
    const disparador = acciones.disparador.current
    if (disparador && disparador !== document.body && disparador.isConnected) disparador.focus()
    else focoAlternativo.current?.focus()
  }
  return (
    <>
      <EventoDialog acciones={acciones} alCerrarFoco={alCerrarFoco} />
      <BorrarEventoDialog acciones={acciones} />
    </>
  )
}
