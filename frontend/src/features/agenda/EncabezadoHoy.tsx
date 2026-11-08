import { Lightbulb, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatearFechaLarga } from '@/lib/fechas'

function plural(n: number, singular: string, pluralTexto: string) {
  return n + ' ' + (n === 1 ? singular : pluralTexto)
}

/** "Hoy", fecha larga y resumen. Cada parte del resumen aparece cuando ya se conoce su dato. */
export function EncabezadoHoy({
  fecha,
  tareasAbiertas,
  eventos,
  alNuevaTarea,
  alRecomendacion,
}: {
  fecha: string
  tareasAbiertas: number | undefined
  eventos: number | undefined
  alNuevaTarea: () => void
  alRecomendacion: () => void
}) {
  const partes = [
    tareasAbiertas !== undefined && plural(tareasAbiertas, 'tarea abierta', 'tareas abiertas'),
    eventos !== undefined && plural(eventos, 'evento', 'eventos'),
  ].filter(Boolean)

  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-4xl">Hoy</h1>
        <p className="mt-1 text-sm text-mut first-letter:uppercase">{formatearFechaLarga(fecha)}</p>
        {partes.length > 0 && <p className="mt-1 text-sm text-mut">{partes.join(', ')}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={alRecomendacion}>
          <Lightbulb aria-hidden="true" />
          Recomendación
        </Button>
        <Button onClick={alNuevaTarea}>
          <Plus aria-hidden="true" />
          Nueva tarea
        </Button>
      </div>
    </header>
  )
}
