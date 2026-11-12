import { cn } from '@/lib/utils'
import { HORIZONTES, type Horizonte } from './useRecomendacion'

interface Props {
  /** `null` = interruptor apagado. */
  horizonte: Horizonte | null
  alEncender: (encendido: boolean) => void
  alElegir: (dias: Horizonte) => void
  deshabilitado: boolean
}

const FOCO = 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** Interruptor «Incluir próximos N días»; el selector de N solo aparece con el interruptor encendido. */
export function HorizonteFuturas({ horizonte, alEncender, alElegir, deshabilitado }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label htmlFor="incluir-futuras" className="inline-flex items-center gap-2 text-sm max-sm:min-h-11">
        <input
          id="incluir-futuras"
          type="checkbox"
          role="switch"
          checked={horizonte !== null}
          disabled={deshabilitado}
          onChange={(e) => alEncender(e.target.checked)}
          className={cn('size-4 accent-acc', FOCO)}
        />
        Incluir próximos N días
      </label>
      {horizonte !== null && (
        <select
          aria-label="Cantidad de días"
          value={horizonte}
          disabled={deshabilitado}
          onChange={(e) => alElegir(Number(e.target.value) as Horizonte)}
          className={cn('h-10 rounded-xl border border-input bg-background px-3 text-sm text-tx max-sm:h-11', FOCO)}
        >
          {HORIZONTES.map((n) => (
            <option key={n} value={n}>
              {n} días
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
