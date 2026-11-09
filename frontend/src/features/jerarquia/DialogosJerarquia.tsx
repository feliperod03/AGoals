import { BorrarItemDialog } from './BorrarItemDialog'
import type { ConfigJerarquia } from './config'
import { ItemDialog, type ObjetivosDisponibles } from './ItemDialog'
import type { ItemJerarquico } from './tipos'
import type { AccionesJerarquia } from './useAccionesJerarquia'

interface Props<T extends ItemJerarquico, R> {
  config: ConfigJerarquia<T, R>
  acciones: AccionesJerarquia<T>
  /** Aviso de la página tras crear o guardar. */
  alMensaje: (mensaje: string) => void
  /** La lista completa (candidatos a padre); `undefined` mientras carga. */
  todos: T[] | undefined
  listaConError: boolean
  objetivos?: ObjetivosDisponibles
}

/** Diálogo de crear/editar y confirmación de borrado; se montan una sola vez en la página (lista o detalle). */
export function DialogosJerarquia<T extends ItemJerarquico, R>({ config, acciones, alMensaje, todos, listaConError, objetivos }: Props<T, R>) {
  return (
    <>
      <ItemDialog
        config={config}
        abierto={acciones.dialogo}
        alCerrar={acciones.cerrarDialogo}
        alGuardar={alMensaje}
        todos={todos}
        listaConError={listaConError}
        objetivos={objetivos}
      />
      <BorrarItemDialog config={config} acciones={acciones} />
    </>
  )
}
