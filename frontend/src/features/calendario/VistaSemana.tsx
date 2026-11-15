import { useEffect, useRef, type KeyboardEvent } from 'react'

import { VARIABLE_ALTO_VENCIDOS } from '@/features/agenda/vencidos'
import { formatearMinutos, nombresDiasSemana } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import {
  PX_POR_HORA_SEMANA,
  diaDestinoSemana,
  minutoInicialSemana,
  offsetInicialSemana,
  rangoDeLaSemana,
  repartirDia,
  type ElementoDia,
} from './calendario'
import { ALTO_ENCABEZADO_DIA, ColumnaDia } from './ColumnaDia'
import { ListaSemana } from './ListaSemana'

const DIAS_SEMANA = nombresDiasSemana()

/** Alto de un chip de la franja más su separación, y relleno vertical de la franja. */
const PX_POR_ELEMENTO_FRANJA = 24
const PX_RELLENO_FRANJA = 8

interface Props {
  /** Las 7 fechas, de lunes a domingo. */
  dias: string[]
  /** Día seleccionado: el único encabezado que entra en el orden de Tab (roving tabindex). */
  dia: string
  hoy: string
  ahora: Date
  elementosPorDia: Map<string, ElementoDia[]>
  /** Id del título de la semana, que le da nombre. */
  etiquetadaPor: string
  /** Un día de esta semana (clic o tecla que no sale de ella). */
  alSeleccionar: (fecha: string) => void
  /** Una tecla que lleva a un día de otra semana. */
  alSaltar: (fecha: string) => void
  /** Abre la edición de un evento (9c). */
  alAbrirEvento?: (evento: Evento) => void
  /** Clic de mouse en un hueco (9c): `minutos` del día, o `null` desde la franja «Sin hora» (evento de todo el día). */
  alCrearEnHueco?: (fecha: string, minutos: number | null) => void
  /**
   * Los datos de ESTA semana ya llegaron (no son los de la anterior mientras carga). El desplazamiento inicial (H-30)
   * espera a que sea `true`: antes no se sabe dónde está el primer evento. Por defecto `true`.
   */
  listo?: boolean
}

/** Holgura que se deja entre la cabecera fija de los días y la hora de destino. */
const HOLGURA_DESPLAZAMIENTO = 8

/** Alto del banner de vencidos pegado arriba (`--alto-vencidos`, lo publica `AvisoVencidos`); 0 si no hay. */
function altoBannerVencidos(): number {
  return Number.parseFloat(document.documentElement.style.getPropertyValue(VARIABLE_ALTO_VENCIDOS)) || 0
}

/**
 * Semana (9b; en 9c, los eventos abren su edición). Con 560 px o más de ancho: eje de horas y siete columnas que comparten rango
 * (`rangoDeLaSemana`) y alto de franja; por debajo, la lista por día. Las dos variantes están en el DOM y una se
 * oculta con un container query (`display: none` la saca también del árbol de accesibilidad), sin JS.
 * Teclado en los encabezados: ← → ±1 día, Inicio/Fin lunes/domingo, RePág/AvPág ±1 semana.
 */
export function VistaSemana({ dias, dia, hoy, ahora, elementosPorDia, etiquetadaPor, alSeleccionar, alSaltar, alAbrirEvento, alCrearEnHueco, listo = true }: Props) {
  const botones = useRef(new Map<string, HTMLButtonElement>())
  // Solo se mueve el foco cuando el cambio de día vino del teclado (un clic ya deja el foco en su botón).
  const enfocarAlCambiar = useRef(false)

  useEffect(() => {
    if (!enfocarAlCambiar.current) return
    enfocarAlCambiar.current = false
    botones.current.get(dia)?.focus()
  }, [dia])

  const repartidos = dias.map((fecha) => repartirDia(elementosPorDia.get(fecha) ?? []))
  const rango = rangoDeLaSemana(repartidos.map((r) => r.conHora))

  /*
    H-30: al abrir una semana, la página se desplaza a la zona útil (la hora actual, el primer evento o las 08:00)
    en vez de quedarse en la madrugada. Ocurre UNA vez por semana mostrada: el efecto depende solo de [lunes, listo].
    Crear, editar, borrar o cerrar un diálogo cambian los datos pero no la semana, así que no mueven la página (si no,
    se perdería el sitio, H-33); si guardar lleva a otra semana, esa semana es "nueva" y se trata como cualquier otra.
    Se usa `scrollTo` y no `scrollIntoView`: así se restan a mano la cabecera fija de los días (ALTO_ENCABEZADO_DIA) y el
    banner de vencidos, que `scrollIntoView` dejaría tapando el destino. Instantáneo (`auto`): sin animación.
    Lo que usa el cálculo se guarda en `ultimos` para que el efecto no dependa de `ahora` (cambia cada minuto).
  */
  const contenedor = useRef<HTMLDivElement>(null)
  const lineaEje = useRef<HTMLDivElement>(null)
  const semanaDesplazada = useRef<string | null>(null)
  const ultimos = useRef({ hoy, ahora, dias, rango, conHora: repartidos.map((r) => r.conHora) })
  useEffect(() => {
    ultimos.current = { hoy, ahora, dias, rango, conHora: repartidos.map((r) => r.conHora) }
  })
  const lunes = dias[0] as string
  useEffect(() => {
    if (!listo || semanaDesplazada.current === lunes) return
    const linea = lineaEje.current
    // Con la lista (ventana angosta) la rejilla está oculta con `display: none`: no hay nada a lo que desplazarse.
    if (!linea || !contenedor.current || getComputedStyle(contenedor.current).display === 'none') return
    semanaDesplazada.current = lunes
    const u = ultimos.current
    const offset = offsetInicialSemana(minutoInicialSemana(u.dias, u.hoy, u.ahora, u.conHora), u.rango)
    // Si lo útil está al principio de la rejilla (semana vacía, o evento a primera hora) no hay nada que bajar: arriba del
    // todo se ve el comienzo de la rejilla y además los controles del calendario.
    const top =
      offset === 0 ? 0 : linea.getBoundingClientRect().top + window.scrollY + offset - ALTO_ENCABEZADO_DIA - altoBannerVencidos() - HOLGURA_DESPLAZAMIENTO
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
  }, [lunes, listo])

  const altoTotal = (rango.finHora - rango.inicioHora) * PX_POR_HORA_SEMANA
  const maxFranja = Math.max(...repartidos.map((r) => r.sinHora.length))
  const altoFranja = maxFranja === 0 ? 0 : maxFranja * PX_POR_ELEMENTO_FRANJA + PX_RELLENO_FRANJA
  // Rótulos del eje: cada hora del rango, borde inferior incluido, salvo las 24 (el calendario nunca escribe «24:00»).
  const horas = Array.from({ length: rango.finHora - rango.inicioHora + 1 }, (_, i) => rango.inicioHora + i).filter((h) => h < 24)

  function alTeclear(evento: KeyboardEvent<HTMLButtonElement>) {
    if (evento.altKey || evento.ctrlKey || evento.metaKey) return
    const destino = diaDestinoSemana(dia, evento.key)
    if (destino === null) return
    evento.preventDefault()
    enfocarAlCambiar.current = true
    if (dias.includes(destino)) alSeleccionar(destino)
    else alSaltar(destino)
  }

  return (
    <section aria-labelledby={etiquetadaPor} className="@container">
      <div ref={contenedor} data-testid="semana-por-horas" className="hidden rounded-card bg-card shadow-card @min-[560px]:flex">
        {/* Eje: deja el hueco del encabezado y de la franja, y rotula las horas. */}
        <div aria-hidden="true" className="w-14 shrink-0">
          <div className="sticky top-[var(--alto-vencidos,0px)] z-20 rounded-tl-card border-b border-line bg-card" style={{ height: ALTO_ENCABEZADO_DIA }} />
          {altoFranja > 0 && (
            <div className="flex items-start justify-end border-b border-line px-1 pt-1.5 text-right text-xs leading-4 whitespace-nowrap text-mut" style={{ height: altoFranja }}>
              Sin hora
            </div>
          )}
          <div className="py-2">
            <div ref={lineaEje} className="relative" style={{ height: altoTotal }}>
              {horas.map((hora) => (
                <span
                  key={hora}
                  className="absolute right-1.5 -translate-y-1/2 text-xs text-mut tabular-nums"
                  style={{ top: (hora - rango.inicioHora) * PX_POR_HORA_SEMANA }}
                >
                  {formatearMinutos(hora * 60)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-7 [&>*:last-child]:rounded-br-card [&>*:last-child>*:first-child]:rounded-tr-card">
          {dias.map((fecha, i) => (
            <ColumnaDia
              key={fecha}
              fecha={fecha}
              hoy={hoy}
              ahora={ahora}
              abreviatura={DIAS_SEMANA[i]?.corto ?? ''}
              seleccionada={fecha === dia}
              elementos={elementosPorDia.get(fecha) ?? []}
              sinHora={repartidos[i]?.sinHora ?? []}
              conHora={repartidos[i]?.conHora ?? []}
              rango={rango}
              altoFranja={altoFranja}
              altoTotal={altoTotal}
              alElegir={alSeleccionar}
              alTeclear={alTeclear}
              alAbrirEvento={alAbrirEvento}
              alCrearEnHueco={alCrearEnHueco}
              botonRef={(boton) => {
                if (boton) botones.current.set(fecha, boton)
                else botones.current.delete(fecha)
              }}
            />
          ))}
        </div>
      </div>

      <div data-testid="semana-en-lista" className="@min-[560px]:hidden">
        <ListaSemana dias={dias} hoy={hoy} elementosPorDia={elementosPorDia} alAbrirEvento={alAbrirEvento} />
      </div>
    </section>
  )
}
