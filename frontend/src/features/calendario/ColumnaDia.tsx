import type { KeyboardEvent, MouseEvent, Ref } from 'react'

import { distribuirSolapes, type Rango } from '@/features/agenda/horario'
import { formatearDiaCorto, formatearMinutos, minutosDelDia } from '@/lib/fechas'
import { cn } from '@/lib/utils'
import type { Evento } from '@/types/evento'
import { BloqueSemana, BotonEditarEvento, TextoParaLector } from './BloqueSemana'
import {
  ATRIBUTO_BLOQUE,
  ATRIBUTO_EVENTO,
  PX_POR_HORA_SEMANA,
  esClicEnHueco,
  etiquetaDia,
  horaDesdePosicion,
  type ElementoConHora,
  type ElementoDia,
} from './calendario'
import { ElementoCelda } from './ElementoCelda'

/** Alto del encabezado de un día (fijo: el eje de horas deja el mismo hueco). */
export const ALTO_ENCABEZADO_DIA = 56

interface Props {
  fecha: string
  hoy: string
  ahora: Date
  /** Abreviatura del día (`lun`). */
  abreviatura: string
  seleccionada: boolean
  /** Todo lo del día (para la etiqueta del grupo), y lo mismo repartido entre franja y línea de tiempo. */
  elementos: ElementoDia[]
  sinHora: ElementoDia[]
  conHora: ElementoConHora[]
  rango: Rango
  /** Alto común de la franja «Sin hora» en las 7 columnas (0 = no hay franja). */
  altoFranja: number
  altoTotal: number
  alElegir: (fecha: string) => void
  alTeclear: (evento: KeyboardEvent<HTMLButtonElement>) => void
  botonRef: Ref<HTMLButtonElement>
  /** Abre la edición de un evento (bloques y chips de la franja). */
  alAbrirEvento?: (evento: Evento) => void
  /** Clic en un hueco: `minutos` del día en la línea de tiempo, `null` en la franja «Sin hora». */
  alCrearEnHueco?: (fecha: string, minutos: number | null) => void
}

/** Sombreado leve al pasar el mouse por un hueco (token `line`, sin colores nuevos; no cambia tamaños). */
const CLASES_HUECO = 'cursor-pointer hover:bg-line/20'

/**
 * Un día de la semana: grupo con la etiqueta completa («martes 10 de noviembre, hoy, 2 eventos, 1 tarea»);
 * dentro, el encabezado (el único control, con un nombre corto, «martes 10», para no repetir la etiqueta larga),
 * la franja «Sin hora» y la línea de tiempo con sus bloques y, si es hoy, la línea de «ahora».
 */
export function ColumnaDia({
  fecha,
  hoy,
  ahora,
  abreviatura,
  seleccionada,
  elementos,
  sinHora,
  conHora,
  rango,
  altoFranja,
  altoTotal,
  alElegir,
  alTeclear,
  botonRef,
  alAbrirEvento,
  alCrearEnHueco,
}: Props) {
  const esHoy = fecha === hoy
  const colocados = distribuirSolapes(conHora)
  const horas = Array.from({ length: rango.finHora - rango.inicioHora }, (_, i) => rango.inicioHora + i)

  const minAhora = minutosDelDia(ahora, fecha)
  const mostrarAhora = esHoy && minAhora >= rango.inicioHora * 60 && minAhora <= rango.finHora * 60
  const topAhora = (minAhora - rango.inicioHora * 60) * (PX_POR_HORA_SEMANA / 60)

  /*
    Crear con un clic en un hueco (9c) es SOLO de mouse: la línea de tiempo y la franja no tienen role, ni tabIndex, ni
    texto para lectores. El equivalente accesible es «Nuevo evento» del encabezado, con el día elegido. Un clic sobre un
    botón, un bloque (evento o tarea) o un chip no cuenta como hueco (`esClicEnHueco`).
  */
  function alClicEnLinea(e: MouseEvent<HTMLDivElement>) {
    if (!alCrearEnHueco || !esClicEnHueco(e.target)) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    alCrearEnHueco(fecha, horaDesdePosicion(y, rango, PX_POR_HORA_SEMANA))
  }
  function alClicEnFranja(e: MouseEvent<HTMLUListElement>) {
    if (alCrearEnHueco && esClicEnHueco(e.target)) alCrearEnHueco(fecha, null)
  }

  return (
    <div
      role="group"
      aria-label={etiquetaDia(fecha, elementos, hoy)}
      className={cn('min-w-0 border-l border-line', seleccionada && 'bg-side')}
    >
      <div
        className={cn('sticky top-0 z-20 flex items-center justify-center border-b border-line', seleccionada ? 'bg-side' : 'bg-card')}
        style={{ height: ALTO_ENCABEZADO_DIA }}
      >
        <button
          ref={botonRef}
          type="button"
          tabIndex={seleccionada ? 0 : -1}
          aria-label={formatearDiaCorto(fecha)}
          aria-pressed={seleccionada}
          aria-current={esHoy ? 'date' : undefined}
          onClick={() => alElegir(fecha)}
          onKeyDown={alTeclear}
          className={cn(
            'flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            seleccionada && 'ring-2 ring-acc',
          )}
        >
          <span className={cn('text-xs font-medium', esHoy ? 'text-tx' : 'text-mut')}>{abreviatura}</span>
          <span
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-full font-serif text-xl leading-none tabular-nums',
              esHoy ? 'bg-acc text-acc-tx' : 'text-tx',
            )}
          >
            {Number(fecha.slice(8, 10))}
          </span>
        </button>
      </div>

      {altoFranja > 0 && (
        <ul
          data-testid="franja-sin-hora"
          className={cn('@container flex flex-col gap-1 border-b border-line px-1 py-1', alCrearEnHueco && CLASES_HUECO)}
          style={{ height: altoFranja }}
          onClick={alClicEnFranja}
        >
          {sinHora.map((e) => (
            <li
              key={e.clave}
              // Todo chip (evento o tarea) es un «bloque»: un clic encima nunca cuenta como hueco de la franja.
              {...{ [ATRIBUTO_BLOQUE]: '', ...(e.tipo === 'evento' ? { [ATRIBUTO_EVENTO]: e.evento.id } : {}) }}
              className="relative min-w-0 focus-within:z-10"
            >
              {e.tipo === 'evento' && alAbrirEvento ? (
                <BotonEditarEvento elemento={e} alAbrirEvento={alAbrirEvento} className="rounded-md" />
              ) : (
                <TextoParaLector elemento={e} />
              )}
              <span aria-hidden="true" className="flex min-w-0 *:flex-1">
                <ElementoCelda elemento={e} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="py-2">
        <div
          data-testid="linea-de-tiempo"
          className={cn('relative', alCrearEnHueco && CLASES_HUECO)}
          style={{ height: altoTotal }}
          onClick={alClicEnLinea}
        >
          {horas.map((hora) => (
            <div key={hora} aria-hidden="true">
              <div className="absolute inset-x-0 border-t border-line" style={{ top: (hora - rango.inicioHora) * PX_POR_HORA_SEMANA }} />
              <div
                className="absolute inset-x-0 border-t border-dashed border-line/50"
                style={{ top: (hora - rango.inicioHora + 0.5) * PX_POR_HORA_SEMANA }}
              />
            </div>
          ))}
          <div aria-hidden="true" className="absolute inset-x-0 border-t border-line" style={{ top: altoTotal }} />

          <ul className="absolute inset-y-0 right-0.5 left-0.5">
            {colocados.map((b) => (
              <BloqueSemana key={b.clave} elemento={b} rango={rango} altoTotal={altoTotal} alAbrirEvento={alAbrirEvento} />
            ))}
          </ul>

          {mostrarAhora && (
            <div
              data-testid="linea-ahora"
              // Es un «bloque» para `esClicEnHueco` y NO lleva `pointer-events-none`: con eso el clic atravesaba la
              // línea y creaba un evento en el hueco de abajo. Sigue sin ser un control (sin tabIndex ni role de botón).
              {...{ [ATRIBUTO_BLOQUE]: '' }}
              role="img"
              aria-label={'Ahora, ' + formatearMinutos(minAhora)}
              className="absolute -right-px -left-1 z-10 flex -translate-y-1/2 items-center"
              style={{ top: topAhora }}
            >
              <span className="size-2.5 shrink-0 rounded-full bg-ahora" />
              <span className="h-0.5 flex-1 bg-ahora" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
