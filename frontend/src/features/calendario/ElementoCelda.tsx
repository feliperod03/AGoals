import { ArrowRight } from 'lucide-react'

import { EstadoIcono } from '@/features/agenda/EstadoIcono'
import { cn } from '@/lib/utils'
import { ATRIBUTO_EVENTO, textoHora, textoHoraCelda, type ElementoDia } from './calendario'

/**
 * La hora del chip solo se ve con la cuadrícula ancha. Umbrales de las container queries (literales de Tailwind,
 * deben coincidir con los de `CeldaDia`): menos de 640 px marcas; de 640 a 980 px chips con solo el título;
 * desde 980 px chips con la hora de inicio.
 */
const CLASES_HORA = 'hidden shrink-0 font-semibold @min-[980px]:inline'

/**
 * Línea compacta de un elemento dentro de la celda de un día. Evento = rectángulo sólido; tarea = píldora con el
 * círculo de su estado (la forma y el ícono distinguen, no solo el color). El botón de la celda lleva la etiqueta
 * accesible completa, así que aquí el estado se dibuja como decoración. Es un solo chip para todos los anchos: lo
 * que cambia es si se muestra la hora. El día de continuación de un evento largo lleva flecha y título; su
 * «hasta 10:00» / «Todo el día» va en el `title`, junto al título.
 *
 * El chip de un evento lleva `data-evento-id` (9c): en la celda del mes, un clic de mouse sobre él abre el evento
 * (`eventoDelClic`). Las marcas de la variante angosta no son este componente, así que allí el clic solo selecciona.
 */
export function ElementoCelda({ elemento }: { elemento: ElementoDia }) {
  const hora = textoHoraCelda(elemento)
  const horaCompleta = textoHora(elemento)
  const titulo = horaCompleta ? `${elemento.titulo} — ${horaCompleta}` : elemento.titulo
  const continuacion = elemento.tipo === 'evento' && elemento.empiezaAntes

  if (elemento.tipo === 'evento') {
    return (
      <span
        {...{ [ATRIBUTO_EVENTO]: elemento.evento.id }}
        title={titulo}
        className="flex min-w-0 items-center gap-1 overflow-hidden rounded-md bg-evento px-1.5 py-0.5 text-xs text-evento-tx">
        {continuacion && <ArrowRight className="size-3 shrink-0" aria-hidden="true" />}
        {hora && <span className={CLASES_HORA}>{hora}</span>}
        <span className="min-w-0 truncate">{elemento.titulo}</span>
      </span>
    )
  }

  const hecha = elemento.estado === 'HECHO'
  return (
    <span
      title={titulo}
      className={cn('flex min-w-0 items-center gap-1 overflow-hidden rounded-full bg-tarea px-1.5 py-0.5 text-xs', hecha ? 'text-mut' : 'text-tarea-tx')}
    >
      <span className="inline-flex shrink-0 [&_svg]:size-3.5">
        <EstadoIcono estado={elemento.estado} decorativo />
      </span>
      {hora && <span className={CLASES_HORA}>{hora}</span>}
      <span className={cn('min-w-0 truncate', hecha && 'line-through')}>{elemento.titulo}</span>
    </span>
  )
}
