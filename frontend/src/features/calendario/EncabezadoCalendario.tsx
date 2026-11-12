import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { Ref } from 'react'

import { Button } from '@/components/ui/button'
import type { Vista } from './calendario'
import { SelectorVista } from './SelectorVista'

interface Props {
  /** «Noviembre de 2026» o «9–15 de noviembre de 2026». */
  titulo: string
  /** Id del título: da nombre a la cuadrícula o a la semana. */
  idTitulo: string
  vista: Vista
  cargando: boolean
  alCambiarVista: (vista: Vista) => void
  alAnterior: () => void
  alSiguiente: () => void
  alHoy: () => void
  /** «Nuevo evento» (9c): crea uno en el día seleccionado. */
  alNuevoEvento: () => void
  /** Para devolverle el foco cuando el elemento que abrió un diálogo de evento ya no existe. */
  botonNuevoRef?: Ref<HTMLButtonElement>
}

const ETIQUETAS: Record<Vista, { anterior: string; siguiente: string }> = {
  mes: { anterior: 'Mes anterior', siguiente: 'Mes siguiente' },
  semana: { anterior: 'Semana anterior', siguiente: 'Semana siguiente' },
}

/**
 * Título (Fraunces), selector «Mes | Semana», ‹ › , «Hoy» y «Nuevo evento», compartido por las dos vistas. El aviso de
 * carga queda siempre en el DOM para que sea una región `status` estable.
 */
export function EncabezadoCalendario({
  titulo,
  idTitulo,
  vista,
  cargando,
  alCambiarVista,
  alAnterior,
  alSiguiente,
  alHoy,
  alNuevoEvento,
  botonNuevoRef,
}: Props) {
  const etiquetas = ETIQUETAS[vista]
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 id={idTitulo} className="text-4xl">
          {titulo}
        </h1>
        <p role="status" className="mt-1 min-h-5 text-sm text-mut">
          {cargando ? 'Cargando…' : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SelectorVista vista={vista} alCambiar={alCambiarVista} />
        <Button type="button" variant="ghost" size="icon" aria-label={etiquetas.anterior} onClick={alAnterior}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={etiquetas.siguiente} onClick={alSiguiente}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button type="button" variant="secondary" onClick={alHoy}>
          Hoy
        </Button>
        <Button ref={botonNuevoRef} type="button" onClick={alNuevoEvento}>
          <Plus aria-hidden="true" />
          Nuevo evento
        </Button>
      </div>
    </header>
  )
}
