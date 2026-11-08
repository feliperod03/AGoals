import { formatearFechaHoraCorta } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import { ErrorEnLinea, Tarjeta, TextoVacio } from './Tarjeta'
import { useTituloRecordatorio } from './useRecordatorios'

interface Consulta<T> {
  datos: T[] | undefined
  cargando: boolean
  error: Error | null
}

export function ProximosRecordatorios({ datos, cargando, error }: Consulta<Recordatorio>) {
  return (
    <Tarjeta titulo="Próximos recordatorios">
      {cargando && <TextoVacio>Cargando…</TextoVacio>}
      {error && <ErrorEnLinea mensaje={error.message} />}
      {datos && datos.length === 0 && <TextoVacio>Aún no tienes recordatorios.</TextoVacio>}
      {datos && datos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {datos.map((r) => (
            <FilaRecordatorio key={r.id} recordatorio={r} />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function FilaRecordatorio({ recordatorio }: { recordatorio: Recordatorio }) {
  const titulo = useTituloRecordatorio(recordatorio)
  return (
    <li>
      <p className="truncate">{titulo}</p>
      <p className="text-xs text-mut">{formatearFechaHoraCorta(recordatorio.fechaHora)}</p>
    </li>
  )
}

export function ProximosEventos({ datos, cargando, error }: Consulta<Evento>) {
  return (
    <Tarjeta titulo="Próximos eventos">
      {cargando && <TextoVacio>Cargando…</TextoVacio>}
      {error && <ErrorEnLinea mensaje={error.message} />}
      {datos && datos.length === 0 && <TextoVacio>Aún no tienes eventos.</TextoVacio>}
      {datos && datos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {datos.map((e) => (
            <li key={e.id}>
              <p className="truncate">{e.titulo}</p>
              <p className="text-xs text-mut">{formatearFechaHoraCorta(e.fechaHoraInicio)}</p>
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}
