import { useRef, useState, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import { useRecordatorioDeEvento } from '@/features/agenda/useRecordatorioDeEvento'
import { formatearFechaHoraCorta, formatearRangoEvento } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import { ElegirAlcance, type Alcance } from './ElegirAlcance'
import { esDeVariosDias } from './formularioEvento'
import type { AccionesEvento } from './useAccionesEvento'

/**
 * Confirmación de borrado, abierta encima de la edición. Antes de confirmar consulta si el evento tiene recordatorio
 * (la base lo borra en cascada) para decirlo: mientras consulta, «Borrar» espera. Si la consulta falla se puede
 * borrar igual con un aviso genérico (el DELETE es el mismo y la cascada ocurre de todos modos), y hay «Reintentar».
 */
export function BorrarEventoDialog({ acciones }: { acciones: AccionesEvento }) {
  const evento = acciones.borrado
  const cancelar = useRef<HTMLButtonElement>(null)
  return (
    <Dialog open={evento !== null} onOpenChange={(open) => !open && !acciones.borrando && acciones.cancelarBorrado()}>
      <DialogContent
        // Foco inicial en «Cancelar»: la acción por defecto de una confirmación destructiva no debe ser borrar.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          cancelar.current?.focus()
        }}
        // Al cancelar, el foco vuelve a «Borrar evento» (Radix solo lo devolvería a un `DialogTrigger`, que no hay).
        // Si se cierra junto con la edición (tras borrar), el foco lo decide la edición.
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          if (acciones.dialogo !== null) acciones.disparadorBorrado.current?.focus()
        }}
      >
        {evento && <Contenido evento={evento} acciones={acciones} cancelar={cancelar} />}
      </DialogContent>
    </Dialog>
  )
}

function Contenido({ evento, acciones, cancelar }: { evento: Evento; acciones: AccionesEvento; cancelar: RefObject<HTMLButtonElement | null> }) {
  const { recordatorio, cargando, fallo, reintentar } = useRecordatorioDeEvento(evento.id)
  const pendiente = acciones.borrando
  const [elegido, setElegido] = useState<Alcance>('este')
  // Un evento suelto no tiene alcance; si un 409 lo dejó sin serie, vuelve a «solo este» aunque estuviera elegido el otro.
  const deSerie = evento.serieId !== null
  const alcance: Alcance = deSerie ? elegido : 'este'
  const rango = formatearRangoEvento(evento.fechaHoraInicio, evento.fechaHoraFin)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Borrar evento</DialogTitle>
        <DialogDescription>
          {alcance === 'siguientes'
            ? `¿Borrar «${evento.titulo}» (${rango}) y todos los siguientes de la serie? Los anteriores se conservan. Es definitivo: no se puede deshacer.`
            : `¿Borrar el evento «${evento.titulo}» (${rango})? Es definitivo: no se puede deshacer.`}
        </DialogDescription>
      </div>
      {deSerie && (
        <ElegirAlcance
          idBase="borrar-evento"
          leyenda="¿Qué eventos se borran?"
          valor={alcance}
          alCambiar={setElegido}
          bloqueado={pendiente}
        />
      )}
      {acciones.avisoBorrar && (
        <p role="status" className="text-sm text-tx">
          {acciones.avisoBorrar}
        </p>
      )}
      {alcance === 'este' && esDeVariosDias(evento) && <p className="text-sm text-tx">Se borra el evento entero, no solo este día.</p>}

      {alcance === 'siguientes' && <p className="text-sm text-tx">También se borrarán los recordatorios de esos eventos.</p>}
      {alcance === 'este' && cargando && <p className="text-sm text-mut">Comprobando si tiene recordatorio…</p>}
      {alcance === 'este' && !cargando && recordatorio && (
        <p className="text-sm text-tx">También se borrará su recordatorio ({formatearFechaHoraCorta(recordatorio.fechaHora)}).</p>
      )}
      {alcance === 'este' && !cargando && fallo && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-tx">No se pudo comprobar si tiene recordatorio: si tiene uno, también se borrará.</p>
          <Button type="button" variant="secondary" size="sm" onClick={reintentar} disabled={pendiente}>
            Reintentar
          </Button>
        </div>
      )}

      <ErrorDialogo mensaje={acciones.errorBorrar} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button ref={cancelar} type="button" variant="secondary" onClick={acciones.cancelarBorrado} disabled={pendiente}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => acciones.borrar(recordatorio !== null, alcance)}
          // La consulta del recordatorio solo importa al borrar un evento: «este y los siguientes» no depende de ella.
          disabled={pendiente || (alcance === 'este' && cargando)}
        >
          {pendiente ? 'Borrando…' : alcance === 'siguientes' ? 'Borrar todos' : 'Borrar'}
        </Button>
      </div>
    </div>
  )
}
