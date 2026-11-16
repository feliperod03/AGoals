import { CAMPO } from '@/features/cofre/estilos'

interface Props {
  conRecordatorio: boolean
  minutosAntes: string
  error?: string
  bloqueado: boolean
  alCambiar: (parcial: { conRecordatorio?: boolean; minutosAntes?: string }) => void
}

/**
 * «Avisarme antes de cada evento» + los minutos. Un solo recordatorio por ocurrencia, con la misma distancia al inicio
 * para todas; el servidor lo crea en la misma llamada que la serie.
 */
export function RecordatorioSerieCampo({ conRecordatorio, minutosAntes, error, bloqueado, alCambiar }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex min-h-11 items-center gap-2 py-1 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-acc"
          checked={conRecordatorio}
          disabled={bloqueado}
          onChange={(e) => alCambiar({ conRecordatorio: e.target.checked })}
          aria-describedby="serie-recordatorio-ayuda"
        />
        Avisarme antes de cada evento
      </label>
      {conRecordatorio && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="serie-minutos" className="sr-only">
            Minutos antes del evento
          </label>
          <input
            id="serie-minutos"
            type="number"
            inputMode="numeric"
            min={0}
            max={10080}
            className={`${CAMPO} w-28`}
            value={minutosAntes}
            disabled={bloqueado}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'serie-minutos-error' : undefined}
            onChange={(e) => alCambiar({ minutosAntes: e.target.value })}
          />
          <span>minutos antes</span>
        </div>
      )}
      {error && (
        <p id="serie-minutos-error" role="alert" className="text-xs text-tx">
          {error}
        </p>
      )}
      <p id="serie-recordatorio-ayuda" className="text-xs text-mut">
        Si la hora del aviso ya pasó (por ejemplo, en el evento de hoy), ese recordatorio no se crea.
      </p>
    </div>
  )
}
