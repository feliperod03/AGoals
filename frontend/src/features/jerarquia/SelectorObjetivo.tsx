import { Link } from 'react-router-dom'

import { ErrorEnLinea } from '@/components/Tarjeta'
import { cn } from '@/lib/utils'
import type { Proyecto } from '@/types/proyecto'
import { opcionesObjetivo } from './candidatosPadre'
import type { ObjetivosDisponibles } from './ItemDialog'
import { useCambiarObjetivo } from './useCambiarObjetivo'

interface Props {
  proyecto: Proyecto
  objetivos: ObjetivosDisponibles
  /** Aviso flotante de la página. */
  alMensaje: (mensaje: string) => void
}

/**
 * Campo «Objetivo» del detalle de un proyecto: cambia el objetivo ahí mismo (PUT con los seis campos, sin abrir la
 * edición completa) con la misma regla del select del diálogo: objetivos abiertos más el actual. «Sin objetivo»
 * lo quita. El select es controlado por `proyecto.objetivoId`: si el PUT falla vuelve solo al valor real.
 */
export function SelectorObjetivo({ proyecto, objetivos, alMensaje }: Props) {
  const cambio = useCambiarObjetivo({ alMensaje })
  const actual = proyecto.objetivoId
  const opciones = opcionesObjetivo(objetivos.lista, actual)
  const nombreActual = opciones.find((o) => o.id === actual)?.texto
  // Cargando: sin la lista solo está el actual y elegir otro no tendría sentido. Si falló se deja quitar el vínculo.
  const cargando = !objetivos.lista && !objetivos.error

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label={`Objetivo de «${proyecto.nombre}»`}
          value={actual === null ? '' : String(actual)}
          disabled={cargando || cambio.pendiente}
          onChange={(e) => {
            const id = e.target.value === '' ? null : Number(e.target.value)
            const elegida = opciones.find((o) => o.id === id)
            cambio.cambiar({
              proyecto,
              destino: id !== null && elegida ? { id, nombre: elegida.texto } : null,
              nombreAnterior: nombreActual,
            })
          }}
          className={cn(
            'max-w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60',
          )}
        >
          <option value="">Sin objetivo</option>
          {opciones.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.texto}
            </option>
          ))}
        </select>
        {actual !== null && (
          <Link
            to={`/objetivos/${actual}`}
            className="rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Ver objetivo
          </Link>
        )}
      </div>
      {objetivos.error && <p className="text-xs text-mut">No se pudo cargar la lista de objetivos.</p>}
      {cambio.error && <ErrorEnLinea mensaje={cambio.error} />}
    </div>
  )
}
