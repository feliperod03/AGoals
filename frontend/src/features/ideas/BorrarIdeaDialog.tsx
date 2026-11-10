import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import type { AccionesIdeas } from './useAccionesIdeas'

/** Confirmación simple de borrado: una idea no tiene dependientes, así que es un DELETE sin parámetros. */
export function BorrarIdeaDialog({ acciones }: { acciones: AccionesIdeas }) {
  const borrado = acciones.borrado
  return (
    <Dialog open={borrado !== null} onOpenChange={(open) => !open && !borrado?.pendiente && borrado?.cancelar()}>
      <DialogContent>
        {borrado && (
          <div className="flex flex-col gap-4">
            <div>
              <DialogTitle>Borrar idea</DialogTitle>
              <DialogDescription>¿Borrar la idea «{borrado.idea.titulo}»? Es definitivo: no se puede deshacer.</DialogDescription>
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
