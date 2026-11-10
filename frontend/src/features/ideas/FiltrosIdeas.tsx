import { Button } from '@/components/ui/button'
import { CAMPO } from '@/features/cofre/estilos'
import type { ItemJerarquico } from '@/features/jerarquia/tipos'
import { porNombre } from '@/features/jerarquia/candidatosPadre'
import { FILTROS_POR_DEFECTO, hayFiltrosActivos, type FiltroEstadoIdea, type FiltrosIdeas as Filtros } from './filtros'
import type { ListaVinculable } from './IdeaDialog'

interface Props {
  filtros: Filtros
  alCambiar: (filtros: Filtros) => void
  proyectos: ListaVinculable
  objetivos: ListaVinculable
}

/** Búsqueda, estado (por defecto, planteadas) y vínculo (todas / sueltas / de un proyecto / de un objetivo). */
export function FiltrosIdeas({ filtros, alCambiar, proyectos, objetivos }: Props) {
  const vinculo = filtros.vinculo
  const tipoLista = vinculo.tipo === 'proyecto' ? proyectos : vinculo.tipo === 'objetivo' ? objetivos : null
  const opciones = (tipoLista?.lista ?? []).slice().sort(porNombre)
  const nota = tipoLista === null ? null : tipoLista.error ? `No se pudo cargar la lista de ${vinculo.tipo === 'proyecto' ? 'proyectos' : 'objetivos'}.` : tipoLista.lista === undefined ? 'Cargando…' : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
          Buscar en título y descripción
          <input type="search" className={CAMPO} value={filtros.busqueda} onChange={(e) => alCambiar({ ...filtros, busqueda: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Estado
          <select className={CAMPO} value={filtros.estado} onChange={(e) => alCambiar({ ...filtros, estado: e.target.value as FiltroEstadoIdea })}>
            <option value="planteadas">Planteadas</option>
            <option value="concluidas">Concluidas</option>
            <option value="todas">Todas</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Vínculo
          <select
            className={CAMPO}
            value={vinculo.tipo}
            onChange={(e) => {
              const tipo = e.target.value as Filtros['vinculo']['tipo']
              alCambiar({ ...filtros, vinculo: tipo === 'proyecto' || tipo === 'objetivo' ? { tipo, id: null } : { tipo } })
            }}
          >
            <option value="todas">Todas</option>
            <option value="sueltas">Sueltas (sin proyecto ni objetivo)</option>
            <option value="proyecto">De un proyecto</option>
            <option value="objetivo">De un objetivo</option>
          </select>
        </label>
        {(vinculo.tipo === 'proyecto' || vinculo.tipo === 'objetivo') && (
          <label className="flex flex-col gap-1 text-sm font-medium">
            {vinculo.tipo === 'proyecto' ? 'Proyecto' : 'Objetivo'}
            <select
              className={CAMPO}
              disabled={tipoLista?.lista === undefined || tipoLista?.error}
              value={vinculo.id ?? ''}
              onChange={(e) => alCambiar({ ...filtros, vinculo: { tipo: vinculo.tipo, id: e.target.value === '' ? null : Number(e.target.value) } })}
            >
              <option value="">{vinculo.tipo === 'proyecto' ? 'Cualquier proyecto' : 'Cualquier objetivo'}</option>
              {opciones.map((o: ItemJerarquico) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {hayFiltrosActivos(filtros) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => alCambiar(FILTROS_POR_DEFECTO)}>
            Volver a la vista por defecto
          </Button>
        )}
      </div>
      {nota && <p className="text-xs text-mut">{nota}</p>}
    </div>
  )
}
