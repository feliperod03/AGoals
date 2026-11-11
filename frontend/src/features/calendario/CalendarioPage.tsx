import { useId, useMemo } from 'react'

import { ErrorEnLinea } from '@/components/Tarjeta'
import { useAhora } from '@/features/agenda/useAhora'
import { useTodasLasTareas } from '@/features/agenda/useTodasLasTareas'
import { diasDeLaSemana, formatearMes, formatearRangoSemana, rangoDeFechas, sumarDias, sumarMeses } from '@/lib/fechas'
import { diasDeLaCuadricula, elementosPorDia } from './calendario'
import { CuadriculaMes } from './CuadriculaMes'
import { DetalleDia } from './DetalleDia'
import { EncabezadoCalendario } from './EncabezadoCalendario'
import { useEstadoCalendario } from './useEstadoCalendario'
import { useEventosEnRango } from './useEventosEnRango'
import { VistaSemana } from './VistaSemana'

/**
 * Calendario en solo lectura: vista mensual (9a: cuadrícula lunes a domingo con panel de detalle) y semanal (9b:
 * eje de horas y siete columnas), con la vista y el día en la URL. Eventos y tareas se piden por separado: si una
 * fuente falla, la otra se sigue viendo y el error sale en línea. Un solo `useEventosEnRango` para las dos vistas,
 * así `keepPreviousData` también evita el parpadeo al cambiar de vista.
 */
export function CalendarioPage() {
  const { ahora, hoy } = useAhora()
  const estado = useEstadoCalendario(hoy)
  const { vista, mes, dia, lunes } = estado
  const idTitulo = useId()

  const dias = useMemo(() => (vista === 'semana' ? diasDeLaSemana(lunes) : diasDeLaCuadricula(mes)), [vista, lunes, mes])
  const rango = rangoDeFechas(dias[0] as string, dias[dias.length - 1] as string)
  const eventos = useEventosEnRango(rango)
  const tareas = useTodasLasTareas()

  const porDia = useMemo(() => elementosPorDia(dias, eventos.data ?? [], tareas.data ?? []), [dias, eventos.data, tareas.data])

  return (
    <div>
      <EncabezadoCalendario
        titulo={vista === 'semana' ? formatearRangoSemana(lunes) : formatearMes(mes)}
        idTitulo={idTitulo}
        vista={vista}
        cargando={eventos.isFetching || tareas.isFetching}
        alCambiarVista={estado.cambiarVista}
        alAnterior={() => (vista === 'semana' ? estado.irASemana(sumarDias(dia, -7)) : estado.irAMes(sumarMeses(mes, -1)))}
        alSiguiente={() => (vista === 'semana' ? estado.irASemana(sumarDias(dia, 7)) : estado.irAMes(sumarMeses(mes, 1)))}
        alHoy={estado.irAHoy}
      />

      {(eventos.error || tareas.error) && (
        <div className="mb-4 flex flex-col gap-2">
          {eventos.error && <ErrorEnLinea mensaje={`No se pudieron cargar los eventos: ${eventos.error.message}`} />}
          {tareas.error && <ErrorEnLinea mensaje={`No se pudieron cargar las tareas: ${tareas.error.message}`} />}
        </div>
      )}

      {vista === 'semana' ? (
        <VistaSemana
          dias={dias}
          dia={dia}
          hoy={hoy}
          ahora={ahora}
          elementosPorDia={porDia}
          etiquetadaPor={idTitulo}
          alSeleccionar={estado.seleccionarDia}
          alSaltar={estado.saltarADia}
        />
      ) : (
        /*
          Disposición sin JS con un container query sobre el ancho del contenido. 1224 px = 900 (base de la cuadrícula)
          + 24 (separación) + 300 (base del panel): desde ahí el panel va al lado (~1544 px de ventana); por debajo se
          apila y ocupa todo el ancho bajo la cuadrícula, para que la cuadrícula conserve celdas anchas.
        */
        <div className="@container">
          <div className="flex flex-col gap-6 @min-[1224px]:flex-row @min-[1224px]:items-start">
            <div className="min-w-0 @min-[1224px]:flex-[1_1_900px]">
              <CuadriculaMes
                mes={mes}
                hoy={hoy}
                dia={dia}
                elementosPorDia={porDia}
                etiquetadaPor={idTitulo}
                alSeleccionar={estado.seleccionarDia}
                alSaltar={estado.saltarADia}
              />
            </div>
            <aside aria-label="Detalle del día" className="min-w-0 @min-[1224px]:max-w-[380px] @min-[1224px]:flex-[1_1_300px]">
              <DetalleDia fecha={dia} hoy={hoy} elementos={porDia.get(dia) ?? []} />
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}
