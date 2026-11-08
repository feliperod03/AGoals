import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Acciones } from './useAccionesTarea'

function ErrorDialogo({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
      {mensaje}
    </p>
  )
}

/** Confirmación de borrado y pregunta por el recordatorio pendiente (se montan una sola vez en la página). */
export function DialogosAcciones({ acciones }: { acciones: Acciones }) {
  const { confirmarBorrado: borrado, preguntaRecordatorio: pregunta } = acciones
  return (
    <>
      <Dialog open={borrado !== null} onOpenChange={(open) => !open && !borrado?.pendiente && borrado?.cancelar()}>
        <DialogContent>
          {borrado && (
            <div className="flex flex-col gap-4">
              <div>
                <DialogTitle>Borrar tarea</DialogTitle>
                <DialogDescription>
                  ¿Borrar «{borrado.tarea.titulo}»? No se puede deshacer; si tiene un recordatorio, se borra con ella.
                </DialogDescription>
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
