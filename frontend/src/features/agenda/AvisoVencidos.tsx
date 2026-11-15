import { BellRing } from 'lucide-react'
import { useEffect, useRef, type RefObject } from 'react'

import { Button } from '@/components/ui/button'
import { enfocarDespues, vecinoDe } from '@/components/ui/focoRespaldo'
import { formatearFechaHoraCorta } from '@/lib/fechas'
import type { Recordatorio } from '@/types/recordatorio'
import { useTituloRecordatorio } from './useRecordatorios'
import { useMarcarEnviado, useRecordatoriosVencidos } from './useRecordatoriosVencidos'
import { VARIABLE_ALTO_VENCIDOS, partirVencidos } from './vencidos'

/** Publica el alto del elemento en `VARIABLE_ALTO_VENCIDOS` mientras `activo`, y la quita al terminar o desmontar. */
function useAltoComoVariable(elemento: RefObject<HTMLElement | null>, activo: boolean) {
  useEffect(() => {
    const el = elemento.current
    if (!activo || !el || typeof ResizeObserver === 'undefined') return
    const raiz = document.documentElement
    const publicar = () => raiz.style.setProperty(VARIABLE_ALTO_VENCIDOS, `${el.offsetHeight}px`)
    publicar()
    const observador = new ResizeObserver(publicar)
    observador.observe(el)
    return () => {
      observador.disconnect()
      raiz.style.removeProperty(VARIABLE_ALTO_VENCIDOS)
    }
  }, [elemento, activo])
}

/**
 * Banner de recordatorios vencidos, arriba del contenido de cualquier página. La región viva
 * (`role="status"`) está SIEMPRE en el DOM, aunque vacía: una región que aparece junto con su contenido no se
 * anuncia. Mostrar un aviso NO lo marca como enviado; solo «Entendido» lo hace.
 *
 * H-36: va en línea pero PEGADO arriba (`sticky`), así se ve aunque la página esté desplazada y no tapa el contenido
 * como lo haría uno superpuesto. La lista tiene altura máxima con scroll propio para que varios avisos no ocupen media
 * pantalla; el «+N más pendientes» queda fuera de ese scroll. Al aparecer entra con un fundido corto (sin movimiento
 * si el usuario lo pidió).
 */
export function AvisoVencidos() {
  const { data } = useRecordatoriosVencidos()
  const { marcar, pendiente, error } = useMarcarEnviado()
  const { visibles, ocultos } = partirVencidos(data ?? [])
  const seccion = useRef<HTMLElement>(null)
  useAltoComoVariable(seccion, visibles.length > 0)

  return (
    // El `sticky` va en la región (hija directa de `<main>`), no en la sección: un sticky solo se mueve dentro de su
    // contenedor, y el de la sección mide lo mismo que ella, así que nunca se habría quedado pegado.
    <div role="status" aria-live="polite" className="sticky top-0 z-30">
      {visibles.length > 0 && (
        <section
          ref={seccion}
          aria-label="Recordatorios vencidos"
          className="mb-6 rounded-xl border border-gold bg-card p-4 shadow-card motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 duration-200"
        >
          <ul className="flex max-h-[min(28vh,13rem)] flex-col gap-3 overflow-y-auto">
            {visibles.map((r) => (
              <FilaVencido
                key={r.id}
                recordatorio={r}
                pendiente={pendiente}
                error={error?.id === r.id ? error.mensaje : null}
                alEntender={() => {
                  // La fila desaparece: el foco pasa al «Entendido» vecino o, sin ninguno, al encabezado de la página (H-37).
                  const vecino = vecinoDe('data-entendido', r.id)
                  marcar(r.id, () => enfocarDespues([vecino ? `[data-entendido="${vecino}"]` : null]))
                }}
              />
            ))}
          </ul>
          {ocultos > 0 && <p className="mt-3 text-xs text-mut">+{ocultos} más pendientes</p>}
        </section>
      )}
    </div>
  )
}

interface FilaProps {
  recordatorio: Recordatorio
  pendiente: boolean
  error: string | null
  alEntender: () => void
}

function FilaVencido({ recordatorio, pendiente, error, alEntender }: FilaProps) {
  const texto = useTituloRecordatorio(recordatorio)
  return (
    <li>
      <div className="flex items-center gap-3">
        <BellRing className="size-4 shrink-0 text-gold" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-tx">{texto}</p>
          <p className="text-xs text-mut">Para el {formatearFechaHoraCorta(recordatorio.fechaHora)}</p>
        </div>
        <Button variant="secondary" size="sm" data-entendido={recordatorio.id} disabled={pendiente} aria-label={`Entendido: ${texto}`} onClick={alEntender}>
          Entendido
        </Button>
      </div>
      {error && <p className="mt-1 pl-7 text-sm text-tx">{error}</p>}
    </li>
  )
}
