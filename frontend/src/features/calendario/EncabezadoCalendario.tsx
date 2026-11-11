import { ChevronLeft, ChevronRight } from 'lucide-react'

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
}

const ETIQUETAS: Record<Vista, { anterior: string; siguiente: string }> = {
  mes: { anterior: 'Mes anterior', siguiente: 'Mes siguiente' },
  semana: { anterior: 'Semana anterior', siguiente: 'Semana siguiente' },
}

/**
 * Título (Fraunces), selector «Mes | Semana», ‹ › y «Hoy», compartido por las dos vistas. El aviso de carga queda
 * siempre en el DOM para que sea una región `status` estable.
 */
export function EncabezadoCalendario({ titulo, idTitulo, vista, cargando, alCambiarVista, alAnterior, alSiguiente, alHoy }: Props) {
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
      </div>
    </header>
  )
}
