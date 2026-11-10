import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatearFechaHoraCorta } from '@/lib/fechas'
import type { DestinoRecordatorio } from './recordatorioForm'
import { RecordatorioDialog } from './RecordatorioDialog'
import type { Evento } from '@/types/evento'
import type { Recordatorio } from '@/types/recordatorio'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { useTituloRecordatorio } from './useRecordatorios'

interface Consulta<T> {
  datos: T[] | undefined
  cargando: boolean
  error: Error | null
}

/**
 * Próximos recordatorios (los 3 siguientes sin enviar). «Nuevo recordatorio» crea uno suelto y «Editar» abre
 * cualquiera de las filas, conservando su tarea o evento. Los avisos salen por `alMensaje` (el de la página).
 */
export function ProximosRecordatorios({ datos, cargando, error, alMensaje }: Consulta<Recordatorio> & { alMensaje: (mensaje: string) => void }) {
  const [destino, setDestino] = useState<DestinoRecordatorio | null>(null)
  return (
    <Tarjeta titulo="Próximos recordatorios">
      {cargando && <TextoVacio>Cargando…</TextoVacio>}
      {error && <ErrorEnLinea mensaje={error.message} />}
      {datos && datos.length === 0 && <TextoVacio>Aún no tienes recordatorios.</TextoVacio>}
      {datos && datos.length > 0 && (
        <ul className="flex flex-col gap-3">
          {datos.map((r) => (
            <FilaRecordatorio key={r.id} recordatorio={r} alEditar={() => setDestino({ tipo: 'existente', recordatorio: r })} />
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setDestino({ tipo: 'suelto' })}>
        Nuevo recordatorio
      </Button>
      {destino && <RecordatorioDialog destino={destino} alCerrar={() => setDestino(null)} alMensaje={alMensaje} />}
    </Tarjeta>
  )
}

function FilaRecordatorio({ recordatorio, alEditar }: { recordatorio: Recordatorio; alEditar: () => void }) {
  const titulo = useTituloRecordatorio(recordatorio)
  return (
    <li className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate">{titulo}</p>
        <p className="text-xs text-mut">{formatearFechaHoraCorta(recordatorio.fechaHora)}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" aria-label={`Editar recordatorio: ${titulo}`} onClick={alEditar}>
        Editar
      </Button>
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
