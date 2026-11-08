import { ProximosEventos, ProximosRecordatorios } from './ColumnaLateral'
import { EncabezadoHoy } from './EncabezadoHoy'
import { armarBloques } from './horario'
import { ListaDelDia } from './ListaDelDia'
import { PlanificacionPorHoras } from './PlanificacionPorHoras'
import { useAgendaDelDia } from './useAgendaDelDia'
import { useAhora } from './useAhora'
import { useEventosDelDia, useProximosEventos } from './useEventos'
import { useProximosRecordatorios } from './useRecordatorios'

const estaAbierta = (estado: string) => estado !== 'HECHO' && estado !== 'CANCELADO'

/**
 * Página Hoy (rebanada 8.1, solo lectura). Las columnas se apilan solas en pantallas angostas
 * (`flex-wrap`). Cada tarjeta maneja su propia carga y error: un fallo en una no tumba las demás.
 */
export function HoyPage() {
  // `hoy` se recalcula cada minuto y al volver a enfocar la pestaña, así la página cambia de día sola.
  const { ahora, hoy } = useAhora()
  const agenda = useAgendaDelDia(hoy)
  const eventosDelDia = useEventosDelDia(hoy)
  const proximosEventos = useProximosEventos()
  const proximosRecordatorios = useProximosRecordatorios(ahora)

  const bloques = armarBloques(agenda.data?.conHora ?? [], eventosDelDia.data ?? [], hoy)
  // Solo cuentan los eventos que realmente tocan el día (los bordes exactos no).
  const cantidadEventos = eventosDelDia.data ? bloques.filter((b) => b.tipo === 'evento').length : undefined
  const tareasAbiertas = agenda.data
    ? [...agenda.data.conHora, ...agenda.data.sinHora].filter((t) => estaAbierta(t.estado)).length
    : undefined

  return (
    <div>
      <EncabezadoHoy fecha={hoy} tareasAbiertas={tareasAbiertas} eventos={cantidadEventos} />

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          <ListaDelDia tareas={agenda.data?.sinHora} cargando={agenda.isPending} error={agenda.error} />
          <PlanificacionPorHoras
            bloques={bloques}
            fecha={hoy}
            ahora={ahora}
            cargando={agenda.isPending || eventosDelDia.isPending}
            errores={[agenda.error, eventosDelDia.error].flatMap((e) => (e ? [e.message] : []))}
          />
        </div>

        <aside className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-6">
          <ProximosRecordatorios
            datos={proximosRecordatorios.data}
            cargando={proximosRecordatorios.isPending}
            error={proximosRecordatorios.error}
          />
          <ProximosEventos datos={proximosEventos.data} cargando={proximosEventos.isPending} error={proximosEventos.error} />
        </aside>
      </div>
    </div>
  )
}
