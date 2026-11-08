import { formatearFechaLarga } from '@/lib/fechas'

function plural(n: number, singular: string, pluralTexto: string) {
  return n + ' ' + (n === 1 ? singular : pluralTexto)
}

/** "Hoy", fecha larga y resumen. Cada parte del resumen aparece cuando ya se conoce su dato. */
export function EncabezadoHoy({
  fecha,
  tareasAbiertas,
  eventos,
}: {
  fecha: string
  tareasAbiertas: number | undefined
  eventos: number | undefined
}) {
  const partes = [
    tareasAbiertas !== undefined && plural(tareasAbiertas, 'tarea abierta', 'tareas abiertas'),
    eventos !== undefined && plural(eventos, 'evento', 'eventos'),
  ].filter(Boolean)

  return (
    <header className="mb-6">
      <h1 className="text-4xl">Hoy</h1>
      <p className="mt-1 text-sm text-mut first-letter:uppercase">{formatearFechaLarga(fecha)}</p>
      {partes.length > 0 && <p className="mt-1 text-sm text-mut">{partes.join(', ')}</p>}
    </header>
  )
}
