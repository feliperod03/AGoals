export type Alcance = 'este' | 'siguientes'

interface Props {
  valor: Alcance
  alCambiar: (alcance: Alcance) => void
  bloqueado: boolean
  /** Prefijo de los `id` (varios grupos pueden convivir en la página). */
  idBase: string
  /** Texto del grupo, p. ej. «¿Qué eventos se borran?». */
  leyenda: string
  /** Si hay, «Este y los siguientes» está deshabilitado y este es el motivo (siempre visible). */
  motivoSiguientesNoDisponible?: string
}

/**
 * «Solo este evento» / «Este y los siguientes» de una serie. Es lo que el backend llama «toda la serie»: las
 * ocurrencias anteriores no se tocan, así que el nombre para el usuario es otro.
 */
export function ElegirAlcance({ valor, alCambiar, bloqueado, idBase, leyenda, motivoSiguientesNoDisponible }: Props) {
  const idMotivo = `${idBase}-motivo`
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{leyenda}</legend>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="radio"
          name={`${idBase}-alcance`}
          className="size-4 accent-acc"
          checked={valor === 'este'}
          disabled={bloqueado}
          onChange={() => alCambiar('este')}
        />
        Solo este evento
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="radio"
          name={`${idBase}-alcance`}
          className="size-4 accent-acc"
          checked={valor === 'siguientes'}
          disabled={bloqueado || motivoSiguientesNoDisponible !== undefined}
          aria-describedby={motivoSiguientesNoDisponible ? idMotivo : undefined}
          onChange={() => alCambiar('siguientes')}
        />
        Este y los siguientes
      </label>
      {motivoSiguientesNoDisponible && (
        <p id={idMotivo} className="text-xs text-mut">
          {motivoSiguientesNoDisponible}
        </p>
      )}
    </fieldset>
  )
}
