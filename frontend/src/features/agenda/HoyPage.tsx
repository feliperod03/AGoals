import { useState } from 'react'

import { RecomendacionDialog } from '@/features/recomendacion/RecomendacionDialog'
import type { Tarea } from '@/types/tarea'
import { ProximosEventos, ProximosRecordatorios } from './ColumnaLateral'
import { DialogosAcciones } from './DialogosAcciones'
import { EncabezadoHoy } from './EncabezadoHoy'
import { armarBloques } from './horario'
import { ListaDelDia } from './ListaDelDia'
import { PlanificacionPorHoras } from './PlanificacionPorHoras'
import { TareaDialog } from './TareaDialog'
import { useAccionesTarea } from './useAccionesTarea'
import { useAgendaDelDia } from './useAgendaDelDia'
import { useAhora } from './useAhora'
import { useMensajeTemporal } from './useMensajeTemporal'
import { useEventosDelDia, useProximosEventos } from './useEventos'
import { useProximosRecordatorios } from './useRecordatorios'

const estaAbierta = (estado: string) => estado !== 'HECHO' && estado !== 'CANCELADO'

/**
 * Página Hoy (rebanadas 8.1, 8.2a y 8.2b: lectura, crear, editar y acciones rápidas sobre tareas). Las columnas se apilan solas en pantallas angostas
 * (`flex-wrap`). Cada tarjeta maneja su propia carga y error: un fallo en una no tumba las demás.
 */
export function HoyPage() {
  // `hoy` se recalcula cada minuto y al volver a enfocar la pestaña, así la página cambia de día sola.
  const { ahora, hoy } = useAhora()
  const agenda = useAgendaDelDia(hoy)
  const eventosDelDia = useEventosDelDia(hoy)
  const proximosEventos = useProximosEventos()
  const proximosRecordatorios = useProximosRecordatorios(ahora)
  // `{}` = diálogo para crear; `{ tarea }` = para editar; `null` = cerrado.
  const [dialogo, setDialogo] = useState<{ tarea?: Tarea } | null>(null)
  const [recomendacionAbierta, setRecomendacionAbierta] = useState(false)
  const confirmacion = useMensajeTemporal()
  // Si el diálogo de edición está abierto sobre una tarea que acaba de cambiar, se cierra: así no se
  // guarda después el estado viejo del formulario encima del nuevo.
  const acciones = useAccionesTarea({
    alMensaje: confirmacion.mostrar,
    alTerminar: (tareaId) => setDialogo((actual) => (actual?.tarea?.id === tareaId ? null : actual)),
  })

  const bloques = armarBloques(agenda.data?.conHora ?? [], eventosDelDia.data ?? [], hoy)
  // Solo cuentan los eventos que realmente tocan el día (los bordes exactos no).
  const cantidadEventos = eventosDelDia.data ? bloques.filter((b) => b.tipo === 'evento').length : undefined
  const tareasAbiertas = agenda.data
    ? [...agenda.data.conHora, ...agenda.data.sinHora].filter((t) => estaAbierta(t.estado)).length
    : undefined

  return (
    <div>
      <EncabezadoHoy fecha={hoy} tareasAbiertas={tareasAbiertas} eventos={cantidadEventos} alNuevaTarea={() => setDialogo({})} alRecomendacion={() => setRecomendacionAbierta(true)} />
      {/* Región viva: el lector de pantalla anuncia la confirmación al guardar. */}
      <p role="status" aria-live="polite" className={confirmacion.mensaje ? '-mt-3 mb-4 text-sm text-tx' : 'sr-only'}>
        {confirmacion.mensaje}
      </p>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
          <ListaDelDia tareas={agenda.data?.sinHora} cargando={agenda.isPending} error={agenda.error} alEditar={(tarea) => setDialogo({ tarea })} acciones={acciones} />
          <PlanificacionPorHoras
            bloques={bloques}
            fecha={hoy}
            ahora={ahora}
            cargando={agenda.isPending || eventosDelDia.isPending}
            errores={[agenda.error, eventosDelDia.error].flatMap((e) => (e ? [e.message] : []))}
            alEditar={(tarea) => setDialogo({ tarea })}
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

      <TareaDialog abierto={dialogo} alCerrar={() => setDialogo(null)} alGuardar={confirmacion.mostrar} acciones={acciones} />
      <RecomendacionDialog
        abierto={recomendacionAbierta}
        alCerrar={() => setRecomendacionAbierta(false)}
        hoy={hoy}
        aviso={confirmacion.mensaje}
        alAvisar={confirmacion.mostrar}
      />
      <DialogosAcciones acciones={acciones} />
    </div>
  )
}
