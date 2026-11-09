import { Button } from '@/components/ui/button'
import { CAMPO } from '@/features/cofre/estilos'
import { hayFiltrosActivos, type FiltroEstado, type FiltrosLista as Filtros } from './filtros'
import { ESTADOS, ETIQUETA_ESTADO } from './tipos'

interface Props {
  filtros: Filtros
  alCambiar: (filtros: Filtros) => void
  alVolverALaVistaPorDefecto: () => void
}

/** Búsqueda por nombre y filtro de estado (por defecto, los abiertos). */
export function FiltrosLista({ filtros, alCambiar, alVolverALaVistaPorDefecto }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
        Buscar por nombre
        <input type="search" className={CAMPO} value={filtros.busqueda} onChange={(e) => alCambiar({ ...filtros, busqueda: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Estado
        <select className={CAMPO} value={filtros.estado} onChange={(e) => alCambiar({ ...filtros, estado: e.target.value as FiltroEstado })}>
          <option value="abiertos">Abiertos</option>
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {ETIQUETA_ESTADO[estado]}
            </option>
          ))}
          <option value="todos">Todos</option>
        </select>
      </label>
      {hayFiltrosActivos(filtros) && (
        <Button type="button" variant="ghost" size="sm" onClick={alVolverALaVistaPorDefecto}>
          Volver a la vista por defecto
        </Button>
      )}
    </div>
  )
}
