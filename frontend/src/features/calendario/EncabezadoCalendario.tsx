import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatearMes } from '@/lib/fechas'

interface Props {
  mes: string
  /** Id del título: da nombre a la cuadrícula. */
  idTitulo: string
  cargando: boolean
  alAnterior: () => void
  alSiguiente: () => void
  alHoy: () => void
}

/** Título del mes (Fraunces), ‹ › y «Hoy». El aviso de carga queda siempre en el DOM para que sea una región `status` estable. */
export function EncabezadoCalendario({ mes, idTitulo, cargando, alAnterior, alSiguiente, alHoy }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 id={idTitulo} className="text-4xl">
          {formatearMes(mes)}
        </h1>
        <p role="status" className="mt-1 min-h-5 text-sm text-mut">
          {cargando ? 'Cargando…' : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Mes anterior" onClick={alAnterior}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Mes siguiente" onClick={alSiguiente}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button type="button" variant="secondary" onClick={alHoy}>
          Hoy
        </Button>
      </div>
    </header>
  )
}
