import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ModoSubtareas, Tarea } from '@/types/tarea'
import { descendientesDe } from './descendientes'
import { ErrorDialogo } from './ErrorDialogo'
import type { Acciones } from './useAccionesTarea'
import { useTodasLasTareas } from './useTodasLasTareas'

type Borrado = NonNullable<Acciones['confirmarBorrado']>

const plural = (n: number) => `${n} ${n === 1 ? 'subtarea' : 'subtareas'}`

/**
 * Confirmación de borrado. Se monta una vez en la página; el contenido (y con él la consulta de todas las
 * tareas y la opción elegida) solo existe con el diálogo abierto, así que cada apertura empieza en "conservar".
 */
export function ConfirmarBorradoDialog({ acciones }: { acciones: Acciones }) {
  const borrado = acciones.confirmarBorrado
  return (
    <Dialog open={borrado !== null} onOpenChange={(open) => !open && !borrado?.pendiente && borrado?.cancelar()}>
      <DialogContent>{borrado && <Contenido borrado={borrado} />}</DialogContent>
    </Dialog>
  )
}

function Contenido({ borrado }: { borrado: Borrado }) {
  const { tarea } = borrado
  const lista = useTodasLasTareas()
  const [modo, setModo] = useState<ModoSubtareas>('conservar')

  // Aunque haya datos en caché se espera a que termine la consulta: el conteo podría estar viejo.
  // Si la consulta falla (y no hay nada) cae al diálogo simple; el backend igual protege con el 409.
  const comprobando = lista.isFetching
  const todas = lista.data
  const descendientes = useMemo(() => (todas ? descendientesDe(tarea.id, todas).todos.length : 0), [todas, tarea.id])
  const madre = tarea.padreId !== null ? todas?.find((t: Tarea) => t.id === tarea.padreId) : undefined
  const conSubtareas = !comprobando && descendientes > 0

  const etiquetaConfirmar = borrado.pendiente
    ? 'Borrando…'
    : !conSubtareas
      ? 'Borrar'
      : modo === 'borrar'
        ? `Borrar la tarea y ${plural(descendientes)}`
        : 'Borrar solo la tarea'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Borrar tarea</DialogTitle>
        {conSubtareas ? (
          <DialogDescription>«{tarea.titulo}» tiene {plural(descendientes)}.</DialogDescription>
        ) : (
          <DialogDescription>
            ¿Borrar «{tarea.titulo}»? No se puede deshacer; si tiene un recordatorio, se borra con ella.
          </DialogDescription>
        )}
      </div>

      {/* Región viva propia: Radix deja el resto de la página con aria-hidden mientras el diálogo está abierto. */}
      <p role="status" aria-live="polite" className={comprobando ? 'text-sm text-mut' : 'sr-only'}>
        {comprobando ? 'Comprobando subtareas…' : ''}
      </p>

      {conSubtareas && (
        <fieldset className="flex flex-col gap-2" disabled={borrado.pendiente}>
          <legend className="mb-1 text-sm font-medium">¿Qué hacemos con las subtareas?</legend>
          <Opcion
            valor="conservar"
            elegido={modo}
            alElegir={setModo}
            etiqueta="Conservar las subtareas"
            ayuda={
              tarea.padreId === null
                ? 'Quedan como tareas sueltas, sin madre.'
                : `Pasan a colgar de ${madre ? `«${madre.titulo}»` : 'su madre'}.`
            }
          />
          <Opcion
            valor="borrar"
            elegido={modo}
            alElegir={setModo}
            etiqueta="Borrar también las subtareas"
            ayuda={`Se borran las ${plural(descendientes)} y sus recordatorios. No se puede deshacer.`}
            peligro
          />
        </fieldset>
      )}

      <ErrorDialogo mensaje={borrado.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={borrado.cancelar} disabled={borrado.pendiente}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={borrado.pendiente || comprobando}
          onClick={() => borrado.confirmar(conSubtareas ? { modo, subtareas: descendientes } : undefined)}
        >
          {etiquetaConfirmar}
        </Button>
      </div>
    </div>
  )
}

interface OpcionProps {
  valor: ModoSubtareas
  elegido: ModoSubtareas
  alElegir: (modo: ModoSubtareas) => void
  etiqueta: string
  ayuda: string
  peligro?: boolean
}

function Opcion({ valor, elegido, alElegir, etiqueta, ayuda, peligro = false }: OpcionProps) {
  const marcada = elegido === valor
  const idAyuda = `borrar-subtareas-${valor}-ayuda`
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2',
        marcada ? (peligro ? 'border-alta bg-alta/10' : 'border-ring bg-muted') : 'border-input',
      )}
    >
      <input
        type="radio"
        name="subtareas"
        value={valor}
        checked={marcada}
        onChange={() => alElegir(valor)}
        aria-describedby={idAyuda}
        className="mt-1 accent-alta"
      />
      <span className="flex flex-col">
        <span className={cn('text-sm font-medium', peligro ? 'text-alta' : 'text-tx')}>{etiqueta}</span>
        <span id={idAyuda} className="text-xs text-mut">
          {ayuda}
        </span>
      </span>
    </label>
  )
}
