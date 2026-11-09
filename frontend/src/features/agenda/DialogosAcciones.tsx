import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from './ErrorDialogo'
import { ConfirmarBorradoDialog } from './ConfirmarBorradoDialog'
import { PosponerDialog } from './PosponerDialog'
import type { Acciones } from './useAccionesTarea'

/** Selector de posponer, confirmación de borrado y pregunta por el recordatorio pendiente (se montan una sola vez en la página). */
export function DialogosAcciones({ acciones, hoy }: { acciones: Acciones; hoy: string }) {
  const { preguntaRecordatorio: pregunta } = acciones
  return (
    <>
      <PosponerDialog acciones={acciones} hoy={hoy} />

      <ConfirmarBorradoDialog acciones={acciones} />

      <Dialog open={pregunta !== null} onOpenChange={(open) => !open && !pregunta?.pendiente && pregunta?.conservar()}>
        <DialogContent>
          {pregunta && (
            <div className="flex flex-col gap-4">
              <div>
                <DialogTitle>Recordatorio pendiente</DialogTitle>
                <DialogDescription>Esta tarea tiene un recordatorio sin enviar. ¿Lo borramos también?</DialogDescription>
              </div>
              <ErrorDialogo mensaje={pregunta.error} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={pregunta.conservar} disabled={pregunta.pendiente}>
                  Conservarlo
                </Button>
                <Button type="button" onClick={pregunta.borrar} disabled={pregunta.pendiente}>
                  {pregunta.pendiente ? 'Borrando…' : 'Borrar recordatorio'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
