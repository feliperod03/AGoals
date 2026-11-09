import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import type { ConfigJerarquia } from './config'
import type { ItemJerarquico } from './tipos'
import type { AccionesJerarquia } from './useAccionesJerarquia'

/**
 * Confirmación de borrado. El backend nunca borra en cascada: si el elemento tiene subelementos, tareas o
 * ideas responde 409 con un mensaje legible, que se muestra tal cual y deja el diálogo abierto.
 */
export function BorrarItemDialog<T extends ItemJerarquico, R>({ config, acciones }: { config: ConfigJerarquia<T, R>; acciones: AccionesJerarquia<T> }) {
  const { borrado } = acciones
  return (
    <Dialog open={borrado !== null} onOpenChange={(open) => !open && !borrado?.pendiente && borrado?.cancelar()}>
      <DialogContent>
        {borrado && (
          <div className="flex flex-col gap-4">
            <div>
              <DialogTitle>Borrar {config.singular}</DialogTitle>
              <DialogDescription>¿Borrar «{borrado.item.nombre}»? No se puede deshacer.</DialogDescription>
            </div>
            <ErrorDialogo mensaje={borrado.error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={borrado.cancelar} disabled={borrado.pendiente}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" onClick={borrado.confirmar} disabled={borrado.pendiente}>
                {borrado.pendiente ? 'Borrando…' : 'Borrar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
