import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  aValorDatetimeLocal,
  diasEntre,
  fechaMinimaParaPosponer,
  formatearDiaMes,
  formatearFechaHoraCorta,
  moverInstanteDias,
  notaRecordatorioTareaYaEnviado,
  puedePosponerAManana,
  sumarDias,
} from '@/lib/fechas'
import type { Tarea } from '@/types/tarea'
import { ErrorDialogo } from './ErrorDialogo'
import { yaPaso } from './recordatorioForm'
import { useRecordatorioDeTarea } from './useRecordatorioDeTarea'
import type { Acciones } from './useAccionesTarea'

/**
 * Selector de "Posponer": Mañana, Elegir fecha o Dejar sin fecha. Se monta una vez en la página y se abre
 * con `acciones.pedirPosponer`. Si la acción falla (400/404/409) queda abierto mostrando el error.
 */
export function PosponerDialog({ acciones, hoy }: { acciones: Acciones; hoy: string }) {
  const { posponer } = acciones
  return (
    <Dialog open={posponer !== null} onOpenChange={(open) => !open && !acciones.pendiente && posponer?.cancelar()}>
      <DialogContent>{posponer && <Selector tarea={posponer.tarea} error={posponer.error} cancelar={posponer.cancelar} acciones={acciones} hoy={hoy} />}</DialogContent>
    </Dialog>
  )
}

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

function Selector({ tarea, error, cancelar, acciones, hoy }: { tarea: Tarea; error: string | null; cancelar: () => void; acciones: Acciones; hoy: string }) {
  const [fecha, setFecha] = useState('')
  const minima = fechaMinimaParaPosponer(tarea.fecha, hoy)
  const manana = sumarDias(hoy, 1)
  const fechaValida = fecha !== '' && fecha >= minima
  const [mover, setMover] = useState(true)
  const { recordatorio, cargando, fallo } = useRecordatorioDeTarea(tarea.id)
  // Mientras carga no se sabe si hay algo que mover: los botones esperan (Cancelar no).
  const ocupado = acciones.pendiente || cargando
  const pendiente = recordatorio !== null && !recordatorio.enviado ? recordatorio : null
  // Un recordatorio ya enviado no se mueve: sin casilla, se dice por qué.
  const yaEnviado = recordatorio !== null && recordatorio.enviado && tarea.fecha !== null ? recordatorio : null
  const hayQueMover = pendiente !== null && tarea.fecha !== null
  const aMover = hayQueMover && mover ? pendiente : undefined
  const puedeManana = puedePosponerAManana(tarea.fecha, hoy)

  /** Instante al que pasaría el recordatorio si la tarea va a `destino`. */
  const nuevoInstante = (destino: string) =>
    pendiente && tarea.fecha ? moverInstanteDias(pendiente.fechaHora, diasEntre(tarea.fecha, destino)) : null
  const destinos = [puedeManana ? { texto: 'Con Mañana', fecha: manana } : null, fechaValida ? { texto: 'Con la fecha elegida', fecha } : null]
    .filter((d) => d !== null)
    .map((d) => ({ texto: d.texto, instante: nuevoInstante(d.fecha) }))
  const seguiraVencido = destinos.some((d) => d.instante !== null && yaPaso(aValorDatetimeLocal(d.instante), new Date()))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Posponer tarea</DialogTitle>
        <DialogDescription>¿A dónde va «{tarea.titulo}»?</DialogDescription>
      </div>

      {hayQueMover && (
        <div className="flex flex-col gap-1 rounded-xl border border-input px-3 py-2">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={mover}
              disabled={ocupado}
              onChange={(e) => setMover(e.target.checked)}
              aria-describedby="posponer-recordatorio-ayuda"
            />
            <span>Mover también el recordatorio (cae el {formatearFechaHoraCorta(pendiente.fechaHora)})</span>
          </label>
          <div id="posponer-recordatorio-ayuda" className="text-xs text-mut">
            {mover ? (
              <>
                {destinos.map((d) => (
                  <p key={d.texto}>
                    {d.texto}: {d.instante && formatearFechaHoraCorta(d.instante)}
                  </p>
                ))}
                {destinos.length === 0 && (
                  <p>{puedeManana ? 'Elige «Mañana» o una fecha' : 'Elige una fecha'} para ver dónde quedará el recordatorio.</p>
                )}
                {seguiraVencido && <p>Seguirá vencido: el aviso saldrá enseguida.</p>}
              </>
            ) : (
              <p>El recordatorio se queda donde está.</p>
            )}
          </div>
        </div>
      )}

      {yaEnviado && <p className="text-xs text-mut">{notaRecordatorioTareaYaEnviado(yaEnviado.fechaHora)}</p>}

      {fallo && <p className="text-xs text-mut">No se pudo consultar el recordatorio de esta tarea: si tiene uno, no se moverá.</p>}

      {puedeManana && (
        <Button type="button" variant="secondary" disabled={ocupado} onClick={() => acciones.ejecutar('posponer', tarea, manana, aMover)}>
          Mañana ({formatearDiaMes(manana)})
        </Button>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (fechaValida && !ocupado) acciones.ejecutar('posponer', tarea, fecha, aMover)
        }}
      >
        <label htmlFor="posponer-fecha" className="text-sm font-medium">
          Elegir fecha
        </label>
        <input
          id="posponer-fecha"
          type="date"
          className={CAMPO}
          min={minima}
          value={fecha}
          disabled={ocupado}
          onChange={(e) => setFecha(e.target.value)}
          aria-describedby="posponer-fecha-ayuda"
        />
        <p id="posponer-fecha-ayuda" className="text-xs text-mut">
          Desde el {formatearDiaMes(minima)}.
        </p>
        <Button type="submit" disabled={ocupado || !fechaValida}>
          Posponer a esa fecha
        </Button>
      </form>

      <div className="flex flex-col gap-1">
        <Button type="button" variant="secondary" disabled={ocupado} onClick={() => acciones.ejecutar('sinFecha', tarea, undefined, pendiente ?? undefined)}>
          Dejar sin fecha
        </Button>
        <p className="text-xs text-mut">
          Sale de la agenda y la verás en el Cofre y en Recomendación.{pendiente && ' El recordatorio no se mueve.'}
        </p>
      </div>

      <ErrorDialogo mensaje={error} />

      <div className="flex justify-end">
        <Button type="button" variant="ghost" disabled={acciones.pendiente} onClick={cancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
