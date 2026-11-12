import { useEffect, useId, useMemo, useRef } from 'react'

import { Aviso } from '@/components/Aviso'
import { ErrorEnLinea } from '@/components/Tarjeta'
import { useAhora } from '@/features/agenda/useAhora'
import { useMensajeTemporal } from '@/features/agenda/useMensajeTemporal'
import { useTodasLasTareas } from '@/features/agenda/useTodasLasTareas'
import { DialogosEvento } from '@/features/eventos/DialogosEvento'
import { valoresParaHueco, valoresParaNuevo, valoresTodoElDia } from '@/features/eventos/formularioEvento'
import { useAccionesEvento } from '@/features/eventos/useAccionesEvento'
import { diasDeLaSemana, formatearMes, formatearRangoSemana, partesLocales, rangoDeFechas, sumarDias, sumarMeses } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import { diasDeLaCuadricula, elementosPorDia } from './calendario'
import { CuadriculaMes } from './CuadriculaMes'
import { DetalleDia } from './DetalleDia'
import { EncabezadoCalendario } from './EncabezadoCalendario'
import { useEstadoCalendario } from './useEstadoCalendario'
import { useEventosEnRango } from './useEventosEnRango'
import { VistaSemana } from './VistaSemana'

/**
 * Calendario: vista mensual (9a: cuadrícula lunes a domingo con panel de detalle) y semanal (9b: eje de horas y siete
 * columnas), con la vista y el día en la URL. Eventos y tareas se piden por separado: si una fuente falla, la otra se
 * sigue viendo y el error sale en línea. Un solo `useEventosEnRango` para las dos vistas, así `keepPreviousData`
 * también evita el parpadeo al cambiar de vista.
 *
 * 9c: crear, editar y borrar eventos. «Nuevo evento» crea en el día seleccionado; las filas del panel, los bloques y
 * los chips de la semana abren la edición. Tras crear, el calendario va al día de inicio del evento (replace si ya se
 * ve, push si no); editar no navega. Crear no depende de que la lista de eventos haya cargado.
 */
export function CalendarioPage() {
  const { ahora, hoy } = useAhora()
  const estado = useEstadoCalendario(hoy)
  const { vista, mes, dia, lunes } = estado
  const idTitulo = useId()
  const confirmacion = useMensajeTemporal()
  const botonNuevo = useRef<HTMLButtonElement>(null)
  const panelDetalle = useRef<HTMLElement>(null)

  const dias = useMemo(() => (vista === 'semana' ? diasDeLaSemana(lunes) : diasDeLaCuadricula(mes)), [vista, lunes, mes])
  const rango = rangoDeFechas(dias[0] as string, dias[dias.length - 1] as string)
  const eventos = useEventosEnRango(rango)
  const tareas = useTodasLasTareas()

  const porDia = useMemo(() => elementosPorDia(dias, eventos.data ?? [], tareas.data ?? []), [dias, eventos.data, tareas.data])

  function irAlDiaDe(evento: Evento) {
    const inicio = partesLocales(evento.fechaHoraInicio).fecha
    if (dias.includes(inicio)) estado.seleccionarDia(inicio)
    else estado.saltarADia(inicio)
  }

  /*
    Con el panel debajo de la cuadrícula, un clic en un día no mostraría nada sin hacer scroll. `nearest` mueve lo
    justo para que se vea el panel (la cuadrícula sigue asomando) y no hace nada si ya se ve, p. ej. con el panel al
    lado. Respeta `prefers-reduced-motion`. Solo lo pide el clic de mouse, no el teclado. Si el día cambia, el scroll se
    hace DESPUÉS de que el panel muestre el día nuevo (su alto puede cambiar y el destino con él).
  */
  const scrollPendiente = useRef(false)
  function scrollAlPanel() {
    const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    panelDetalle.current?.scrollIntoView?.({ block: 'nearest', behavior: sinMovimiento ? 'auto' : 'smooth' })
  }
  function alClicDia(fecha: string) {
    if (fecha === dia) scrollAlPanel()
    else scrollPendiente.current = true
  }
  useEffect(() => {
    if (!scrollPendiente.current) return
    scrollPendiente.current = false
    scrollAlPanel()
  }, [dia])

  const acciones = useAccionesEvento({ alMensaje: confirmacion.mostrar, alCrear: irAlDiaDe })
  const crearEnDia = (fecha: string) => acciones.abrirCrear(valoresParaNuevo(fecha, hoy, ahora))
  const crearEnHueco = (fecha: string, minutos: number | null) =>
    acciones.abrirCrear(minutos === null ? valoresTodoElDia(fecha) : valoresParaHueco(fecha, minutos))

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
        alNuevoEvento={() => crearEnDia(dia)}
        botonNuevoRef={botonNuevo}
      />
      <Aviso
        mensaje={confirmacion.mensaje}
        saliendo={confirmacion.saliendo}
        alCerrar={confirmacion.cerrar}
        alPausar={confirmacion.pausar}
        alReanudar={confirmacion.reanudar}
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
          alAbrirEvento={acciones.abrirEditar}
          alCrearEnHueco={crearEnHueco}
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
                alAbrirEvento={acciones.abrirEditar}
                alClicDia={alClicDia}
              />
            </div>
            <aside ref={panelDetalle} aria-label="Detalle del día" className="scroll-mb-4 min-w-0 @min-[1224px]:max-w-[380px] @min-[1224px]:flex-[1_1_300px]">
              <DetalleDia
                fecha={dia}
                hoy={hoy}
                elementos={porDia.get(dia) ?? []}
                alAbrirEvento={acciones.abrirEditar}
                alAgregarEvento={crearEnDia}
              />
            </aside>
          </div>
        </div>
      )}

      <DialogosEvento acciones={acciones} focoAlternativo={botonNuevo} />
    </div>
  )
}
