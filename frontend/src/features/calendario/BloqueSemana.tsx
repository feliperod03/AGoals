import { ArrowRight } from 'lucide-react'

import { EstadoIcono } from '@/features/agenda/EstadoIcono'
import { posicionBloque, type Colocacion, type Rango } from '@/features/agenda/horario'
import { cn } from '@/lib/utils'
import type { Evento } from '@/types/evento'
import {
  ALTO_BLOQUE_CON_DOS_LINEAS,
  ATRIBUTO_BLOQUE,
  ATRIBUTO_EVENTO,
  etiquetaEditarEvento,
  PX_POR_HORA_SEMANA,
  lineasDeTitulo,
  textoHoraBloque,
  tipoYHoraParaLector,
  tituloDeBloque,
  type ElementoConHora,
  type ElementoDia,
} from './calendario'

/** Frase para lectores de pantalla: «Evento, 09:00–10:00, Reunión» / «Tarea, sin hora, Hecha, Pagar la luz». */
export function TextoParaLector({ elemento }: { elemento: ElementoDia }) {
  return (
    <span className="sr-only">
      {tipoYHoraParaLector(elemento)},{' '}
      {elemento.tipo === 'tarea' && (
        <>
          <EstadoIcono estado={elemento.estado} />,{' '}
        </>
      )}
      {elemento.titulo}
    </span>
  )
}

interface Props {
  elemento: ElementoConHora & Colocacion
  rango: Rango
  /** Alto total de la línea de tiempo: ningún bloque se dibuja más abajo (uno de 23:50 a 24:00 mide 30 min). */
  altoTotal: number
  /** Abre la edición del evento (9c). Sin ella, el bloque es solo lectura. */
  alAbrirEvento?: (evento: Evento) => void
}

/**
 * Botón vacío que cubre un evento entero y abre su edición. Va como HERMANO del dibujo (nunca un `div` dentro de un
 * `button`): el dibujo sigue `aria-hidden`, con su `title` y su container query, y el botón lleva el nombre accesible
 * («Editar evento: Reunión, 09:00–10:00»). Lo usan los bloques y los chips de la franja «Sin hora».
 */
export function BotonEditarEvento({
  elemento,
  alAbrirEvento,
  className,
}: {
  elemento: Extract<ElementoDia, { tipo: 'evento' }>
  alAbrirEvento: (evento: Evento) => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={etiquetaEditarEvento(elemento)}
      onClick={() => alAbrirEvento(elemento.evento)}
      className={cn('absolute inset-0 z-10 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', className)}
    />
  )
}

/**
 * Un evento o una tarea con hora en la columna de un día. Lo visual es `aria-hidden`; el lector lee una sola frase
 * («Evento, 09:00–10:00, Reunión»), que no depende del ancho. Cada bloque es su propio container query, así el mismo
 * umbral sirve para el ancho de la columna y para los solapes:
 * - alto (>= 40 px): la hora en una línea (desde 56 px de ancho) y el título debajo, con tantas líneas como quepan;
 * - corto: una línea; la hora delante del título solo desde 100 px (ancho interior, sin el relleno).
 * Evento = rectángulo (radio chico, recto donde lo corta la medianoche); tarea = radio grande y círculo de estado.
 */
export function BloqueSemana({ elemento, rango, altoTotal, alAbrirEvento }: Props) {
  const posicion = posicionBloque(elemento.inicioMin, elemento.finMin, rango, PX_POR_HORA_SEMANA)
  const alto = Math.min(posicion.height, altoTotal - posicion.top)
  const dosLineas = alto >= ALTO_BLOQUE_CON_DOS_LINEAS
  const esEvento = elemento.tipo === 'evento'
  const hecha = elemento.tipo === 'tarea' && elemento.estado === 'HECHO'
  const continuacion = elemento.tipo === 'evento' && elemento.empiezaAntes
  const lineas = lineasDeTitulo(alto, dosLineas)

  const icono =
    elemento.tipo === 'tarea' ? (
      <span className="inline-flex shrink-0 [&_svg]:size-3.5">
        <EstadoIcono estado={elemento.estado} decorativo />
      </span>
    ) : continuacion ? (
      <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
    ) : null
  const hora = textoHoraBloque(elemento)
  const marcas = { [ATRIBUTO_BLOQUE]: '', ...(elemento.tipo === 'evento' ? { [ATRIBUTO_EVENTO]: elemento.evento.id } : {}) }

  return (
    <li
      {...marcas}
      // Con el foco dentro, el bloque pasa por delante de sus vecinos para que el anillo se vea entero.
      className="absolute focus-within:z-10"
      style={{
        top: posicion.top,
        height: Math.max(alto - 1, 0),
        left: `${(elemento.columna / elemento.totalColumnas) * 100}%`,
        width: `calc(${100 / elemento.totalColumnas}% - 2px)`,
      }}
    >
      {elemento.tipo === 'evento' && alAbrirEvento ? (
        <BotonEditarEvento
          elemento={elemento}
          alAbrirEvento={alAbrirEvento}
          className={cn('rounded-md', elemento.empiezaAntes && 'rounded-t-none', elemento.terminaDespues && 'rounded-b-none')}
        />
      ) : (
        <TextoParaLector elemento={elemento} />
      )}
      <div
        aria-hidden="true"
        data-testid="bloque-semana"
        title={tituloDeBloque(elemento)}
        className={cn(
          '@container h-full overflow-hidden px-1.5 text-xs leading-4 ring-2 ring-card',
          esEvento ? 'rounded-md bg-evento text-evento-tx' : cn('bg-tarea', dosLineas ? 'rounded-xl' : 'rounded-full', hecha ? 'text-mut' : 'text-tarea-tx'),
          esEvento && elemento.empiezaAntes && 'rounded-t-none',
          esEvento && elemento.terminaDespues && 'rounded-b-none',
          dosLineas ? 'flex flex-col py-0.5' : 'flex items-center gap-1',
        )}
      >
        {dosLineas ? (
          <>
            <span className="flex min-w-0 items-center gap-1">
              {icono}
              <span className="hidden truncate font-semibold tabular-nums @min-[56px]:inline">{hora}</span>
            </span>
            <span
              className={cn('min-w-0 break-words', hecha && 'line-through')}
              style={{ display: '-webkit-box', WebkitLineClamp: lineas, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {elemento.titulo}
            </span>
          </>
        ) : (
          <>
            {icono}
            <span className="hidden shrink-0 font-semibold tabular-nums @min-[100px]:inline">{hora}</span>
            <span className={cn('min-w-0 truncate', hecha && 'line-through')}>{elemento.titulo}</span>
          </>
        )}
      </div>
    </li>
  )
}
