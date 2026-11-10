import { BellRing } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatearFechaHoraCorta } from '@/lib/fechas'
import type { Recordatorio } from '@/types/recordatorio'
import { useTituloRecordatorio } from './useRecordatorios'
import { useMarcarEnviado, useRecordatoriosVencidos } from './useRecordatoriosVencidos'
import { partirVencidos } from './vencidos'

/**
 * Banner de recordatorios vencidos, en línea arriba del contenido de cualquier página. La región viva
 * (`role="status"`) está SIEMPRE en el DOM, aunque vacía: una región que aparece junto con su contenido no se
 * anuncia. Mostrar un aviso NO lo marca como enviado; solo «Entendido» lo hace.
 */
export function AvisoVencidos() {
  const { data } = useRecordatoriosVencidos()
  const { marcar, pendiente, error } = useMarcarEnviado()
  const { visibles, ocultos } = partirVencidos(data ?? [])

  return (
    <div role="status" aria-live="polite">
      {visibles.length > 0 && (
        <section aria-label="Recordatorios vencidos" className="mb-6 rounded-xl border border-gold bg-card p-4 shadow-card">
          <ul className="flex flex-col gap-3">
            {visibles.map((r) => (
              <FilaVencido
                key={r.id}
                recordatorio={r}
                pendiente={pendiente}
                error={error?.id === r.id ? error.mensaje : null}
                alEntender={() => marcar(r.id)}
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
        <Button variant="secondary" size="sm" disabled={pendiente} aria-label={`Entendido: ${texto}`} onClick={alEntender}>
          Entendido
        </Button>
      </div>
      {error && <p className="mt-1 pl-7 text-sm text-tx">{error}</p>}
    </li>
  )
}
