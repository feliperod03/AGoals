import { Campo } from '@/components/Campo'
import { CAMPO } from '@/features/cofre/estilos'
import { cn } from '@/lib/utils'
import { DIAS_SEMANA, type ErroresSerie, type Repetir, type ValoresSerie } from './formularioSerie'
import { RecordatorioSerieCampo } from './RecordatorioSerieCampo'

interface Props {
  valores: ValoresSerie
  alCambiar: (parcial: Partial<ValoresSerie>) => void
  errores: ErroresSerie
  /** «Todo el día» marcado: las series no lo admiten, así que «Repetir» no se puede activar. */
  todoElDia: boolean
  bloqueado: boolean
  /** Texto de la vista previa (cuántos eventos y entre qué días), o `null` si todavía no se puede calcular. */
  vistaPrevia: string | null
}

/**
 * Sub-formulario «Repetir» de «Nuevo evento» (la regla no se puede cambiar después, así que al editar no existe).
 * Es controlado: el estado vive en `EventoDialog`. Con «Todo el día» queda deshabilitado y dice por qué.
 */
export function RepetirCampos({ valores, alCambiar, errores, todoElDia, bloqueado, vistaPrevia }: Props) {
  const repite = valores.repetir !== 'no'

  function alternarDia(dia: (typeof DIAS_SEMANA)[number]['dia'], marcado: boolean) {
    const nuevos = marcado ? [...valores.diasSemana, dia] : valores.diasSemana.filter((d) => d !== dia)
    // Siempre en el orden de la semana, sea cual sea el orden en que se marcaron.
    alCambiar({ diasSemana: DIAS_SEMANA.map((d) => d.dia).filter((d) => nuevos.includes(d)) })
  }

  return (
    <div className="flex flex-col gap-3">
      <Campo id="serie-repetir" etiqueta="Repetir">
        <select
          id="serie-repetir"
          className={CAMPO}
          value={valores.repetir}
          disabled={todoElDia || bloqueado}
          aria-describedby={todoElDia ? 'serie-repetir-ayuda' : undefined}
          onChange={(e) => alCambiar({ repetir: e.target.value as Repetir })}
        >
          <option value="no">No se repite</option>
          <option value="SEMANAL">Cada semana</option>
          <option value="MENSUAL">Cada mes</option>
        </select>
      </Campo>
      {todoElDia && (
        <p id="serie-repetir-ayuda" className="-mt-2 text-xs text-mut">
          Los eventos de todo el día no se pueden repetir.
        </p>
      )}

      {repite && (
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          {valores.repetir === 'SEMANAL' && (
            <>
              <fieldset className="flex flex-col gap-1" aria-describedby={errores.dias ? 'serie-dias-error' : undefined}>
                <legend className="mb-1 text-sm font-medium">Días de la semana</legend>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map(({ dia, letra, nombre }) => (
                    <label
                      key={dia}
                      className={cn(
                        'flex size-10 cursor-pointer items-center justify-center rounded-full border border-input text-sm font-medium max-sm:size-11',
                        'has-checked:border-acc has-checked:bg-acc has-checked:text-acc-tx has-focus-visible:ring-2 has-focus-visible:ring-ring',
                        bloqueado && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        id={`serie-dia-${dia}`}
                        type="checkbox"
                        className="sr-only"
                        checked={valores.diasSemana.includes(dia)}
                        disabled={bloqueado}
                        onChange={(e) => alternarDia(dia, e.target.checked)}
                      />
                      <span aria-hidden="true">{letra}</span>
                      <span className="sr-only">{nombre}</span>
                    </label>
                  ))}
                </div>
                {errores.dias && (
                  <p id="serie-dias-error" role="alert" className="text-xs text-tx">
                    {errores.dias}
                  </p>
                )}
              </fieldset>
              <Campo id="serie-intervalo" etiqueta="Frecuencia">
                <select
                  id="serie-intervalo"
                  className={CAMPO}
                  value={valores.intervaloSemanas}
                  disabled={bloqueado}
                  onChange={(e) => alCambiar({ intervaloSemanas: e.target.value === '2' ? '2' : '1' })}
                >
                  <option value="1">Todas las semanas</option>
                  <option value="2">Cada 2 semanas</option>
                </select>
              </Campo>
            </>
          )}

          {valores.repetir === 'MENSUAL' && (
            <div className="flex flex-col gap-1">
              <Campo id="serie-dia-mes" etiqueta="Día del mes" error={errores.diaMes}>
                <input
                  id="serie-dia-mes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  className={`${CAMPO} w-28`}
                  value={valores.diaMes}
                  disabled={bloqueado}
                  aria-invalid={errores.diaMes ? true : undefined}
                  aria-describedby={errores.diaMes ? 'serie-dia-mes-error' : undefined}
                  onChange={(e) => alCambiar({ diaMes: e.target.value })}
                />
              </Campo>
              {Number(valores.diaMes) > 28 && <p className="text-xs text-mut">Los meses que no tienen ese día usan su último día.</p>}
            </div>
          )}

          <fieldset className="flex flex-col gap-2" aria-describedby={errores.final ? 'serie-final-error' : undefined}>
            <legend className="mb-1 text-sm font-medium">Termina</legend>
            <div className="flex min-h-11 flex-wrap items-center gap-2 text-sm">
              <input
                id="serie-final-repeticiones"
                type="radio"
                name="serie-final"
                className="size-4 accent-acc"
                checked={valores.final === 'repeticiones'}
                disabled={bloqueado}
                onChange={() => alCambiar({ final: 'repeticiones' })}
              />
              <label htmlFor="serie-final-repeticiones">Después de</label>
              <input
                id="serie-repeticiones"
                type="number"
                inputMode="numeric"
                min={1}
                max={260}
                aria-label="Número de veces"
                className={`${CAMPO} w-24`}
                value={valores.repeticiones}
                disabled={bloqueado || valores.final !== 'repeticiones'}
                aria-invalid={errores.final && valores.final === 'repeticiones' ? true : undefined}
                onChange={(e) => alCambiar({ repeticiones: e.target.value })}
              />
              <span>veces</span>
            </div>
            <div className="flex min-h-11 flex-wrap items-center gap-2 text-sm">
              <input
                id="serie-final-hasta"
                type="radio"
                name="serie-final"
                className="size-4 accent-acc"
                checked={valores.final === 'hasta'}
                disabled={bloqueado}
                onChange={() => alCambiar({ final: 'hasta' })}
              />
              <label htmlFor="serie-final-hasta">El día</label>
              <input
                id="serie-hasta"
                type="date"
                aria-label="Fecha final"
                className={CAMPO}
                value={valores.hasta}
                disabled={bloqueado || valores.final !== 'hasta'}
                aria-invalid={errores.final && valores.final === 'hasta' ? true : undefined}
                onChange={(e) => alCambiar({ hasta: e.target.value })}
              />
            </div>
            {errores.final && (
              <p id="serie-final-error" role="alert" className="text-xs text-tx">
                {errores.final}
              </p>
            )}
          </fieldset>

          <RecordatorioSerieCampo
            conRecordatorio={valores.conRecordatorio}
            minutosAntes={valores.minutosAntes}
            error={errores.minutos}
            bloqueado={bloqueado}
            alCambiar={alCambiar}
          />

          <p aria-live="polite" className="text-sm text-mut">
            {vistaPrevia}
          </p>
        </div>
      )}
    </div>
  )
}
