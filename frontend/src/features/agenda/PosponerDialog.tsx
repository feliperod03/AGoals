import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { fechaMinimaParaPosponer, formatearDiaMes, puedePosponerAManana, sumarDias } from '@/lib/fechas'
import type { Tarea } from '@/types/tarea'
import type { Acciones } from './useAccionesTarea'

/**
 * Selector de "Posponer": Mañana, Elegir fecha o Dejar sin fecha. Se monta una vez en la página y se abre
 * con `acciones.pedirPosponer`. Si la acción falla (400/404/409) queda abierto mostrando el error.
 */
export function PosponerDialog({ acciones, hoy }: { acciones: Acciones; hoy: string }) {
  const { posponer } = acciones
  return (
    <Dialog open={posponer !== null} onOpenChange={(open) => !open && !acciones.pendiente && posponer?.cancelar()}>
      <DialogContent>{posponer && <Selector tarea={posponer.tarea} cancelar={posponer.cancelar} acciones={acciones} hoy={hoy} />}</DialogContent>
    </Dialog>
  )
}

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

function Selector({ tarea, cancelar, acciones, hoy }: { tarea: Tarea; cancelar: () => void; acciones: Acciones; hoy: string }) {
  const [fecha, setFecha] = useState('')
  const minima = fechaMinimaParaPosponer(tarea.fecha, hoy)
  const manana = sumarDias(hoy, 1)
  const fechaValida = fecha !== '' && fecha >= minima
  const ocupado = acciones.pendiente

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Posponer tarea</DialogTitle>
        <DialogDescription>¿A dónde va «{tarea.titulo}»?</DialogDescription>
      </div>

      {puedePosponerAManana(tarea.fecha, hoy) && (
        <Button type="button" variant="secondary" disabled={ocupado} onClick={() => acciones.ejecutar('posponer', tarea, manana)}>
          Mañana ({formatearDiaMes(manana)})
        </Button>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (fechaValida) acciones.ejecutar('posponer', tarea, fecha)
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
        <Button type="button" variant="secondary" disabled={ocupado} onClick={() => acciones.ejecutar('sinFecha', tarea)}>
          Dejar sin fecha
        </Button>
        <p className="text-xs text-mut">Sale de la agenda y la verás en Recomendación.</p>
      </div>

      {acciones.error && (
        <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
          {acciones.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" disabled={ocupado} onClick={cancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
