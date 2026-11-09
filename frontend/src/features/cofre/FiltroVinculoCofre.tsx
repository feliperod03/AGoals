import { CAMPO } from './estilos'
import type { FiltroVinculo } from './filtros'

interface Opcion {
  id: number
  nombre: string
}

interface Props {
  vinculo: FiltroVinculo
  alCambiar: (vinculo: FiltroVinculo) => void
  proyectos: Opcion[] | undefined
  objetivos: Opcion[] | undefined
  /** Mensaje si falló la carga de proyectos u objetivos. */
  error: string | null
}

/** Filtro por vínculo directo: cualquiera / suelta (sin proyecto ni objetivo) / proyecto / objetivo (uno concreto o cualquiera). */
export function FiltroVinculoCofre({ vinculo, alCambiar, proyectos, objetivos, error }: Props) {
  const opciones = vinculo.tipo === 'proyecto' ? proyectos : vinculo.tipo === 'objetivo' ? objetivos : undefined

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Vínculo
          <select
            className={CAMPO}
            value={vinculo.tipo}
            onChange={(e) => {
              const tipo = e.target.value as FiltroVinculo['tipo']
              alCambiar(tipo === 'proyecto' || tipo === 'objetivo' ? { tipo, id: null } : { tipo })
            }}
          >
            <option value="cualquiera">Cualquiera</option>
            <option value="suelta">Suelta (sin proyecto ni objetivo)</option>
            <option value="proyecto">De un proyecto</option>
            <option value="objetivo">De un objetivo</option>
          </select>
        </label>

        {(vinculo.tipo === 'proyecto' || vinculo.tipo === 'objetivo') && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {vinculo.tipo === 'proyecto' ? 'Proyecto' : 'Objetivo'}
            <select
              className={CAMPO}
              value={vinculo.id ?? ''}
              onChange={(e) => alCambiar({ tipo: vinculo.tipo, id: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">{vinculo.tipo === 'proyecto' ? 'Cualquier proyecto' : 'Cualquier objetivo'}</option>
              {(opciones ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
          {error}
        </p>
      )}
    </div>
  )
}
