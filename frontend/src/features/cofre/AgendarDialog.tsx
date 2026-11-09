import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { Tarea } from '@/types/tarea'

interface Props {
  /** Tarea a agendar con sus subtareas candidatas; `null` = cerrado. */
  abierto: { tarea: Tarea; candidatas: number } | null
  pendiente: boolean
  error: string | null
  alConfirmar: (tarea: Tarea, incluirSubtareas: boolean) => void
  alCerrar: () => void
}

/** Pregunta si "Agendar para hoy" lleva también las subtareas candidatas (marcado por defecto, como el backend). */
export function AgendarDialog({ abierto, pendiente, error, alConfirmar, alCerrar }: Props) {
  return (
    <Dialog open={abierto !== null} onOpenChange={(open) => !open && !pendiente && alCerrar()}>
      <DialogContent>{abierto && <Contenido abierto={abierto} pendiente={pendiente} error={error} alConfirmar={alConfirmar} alCerrar={alCerrar} />}</DialogContent>
    </Dialog>
  )
}

function Contenido({ abierto, pendiente, error, alConfirmar, alCerrar }: Omit<Props, 'abierto'> & { abierto: NonNullable<Props['abierto']> }) {
  const { tarea, candidatas } = abierto
  const [incluir, setIncluir] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Agendar para hoy</DialogTitle>
        <DialogDescription>«{tarea.titulo}» pasará a la agenda de hoy.</DialogDescription>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={incluir} disabled={pendiente} onChange={(e) => setIncluir(e.target.checked)} />
        Incluir {candidatas} {candidatas === 1 ? 'subtarea' : 'subtareas'}
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={pendiente} onClick={alCerrar}>
          Cancelar
        </Button>
        <Button type="button" disabled={pendiente} onClick={() => alConfirmar(tarea, incluir)}>
          {pendiente ? 'Agendando…' : 'Agendar para hoy'}
        </Button>
      </div>
    </div>
  )
}
