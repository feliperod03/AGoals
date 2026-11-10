import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Aviso } from '@/components/Aviso'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { useMensajeTemporal } from '@/features/agenda/useMensajeTemporal'
import { CONFIG_OBJETIVO, CONFIG_PROYECTO } from '@/features/jerarquia/config'
import { useListaJerarquia } from '@/features/jerarquia/useListaJerarquia'
import { DialogosIdeas } from './DialogosIdeas'
import { FILTROS_POR_DEFECTO, filtrarIdeas, ordenarIdeas, textoVacioIdeas, type FiltrosIdeas as Filtros } from './filtros'
import { FiltrosIdeas } from './FiltrosIdeas'
import { ListaIdeas } from './ListaIdeas'
import { useAccionesIdeas } from './useAccionesIdeas'
import { useIdeas } from './useIdeas'

/** Página Ideas (8.4c): lista con filtros, crear / editar / concluir / reabrir / borrar y aviso flotante. */
export function IdeasPage() {
  const ideas = useIdeas()
  // Las mismas consultas del Cofre y de Proyectos/Objetivos (comparten caché): nombres del vínculo y candidatos.
  const proyectos = useListaJerarquia(CONFIG_PROYECTO)
  const objetivos = useListaJerarquia(CONFIG_OBJETIVO)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_POR_DEFECTO)
  const confirmacion = useMensajeTemporal()
  const acciones = useAccionesIdeas({ alMensaje: confirmacion.mostrar })

  const visibles = useMemo(() => (ideas.data ? ordenarIdeas(filtrarIdeas(ideas.data, filtros)) : undefined), [ideas.data, filtros])
  const listaProyectos = { lista: proyectos.data, error: proyectos.isError }
  const listaObjetivos = { lista: objetivos.data, error: objetivos.isError }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">Ideas</h1>
          <p className="mt-1 text-sm text-mut">Lo que se te ocurre, con su conclusión cuando la cierras. Por defecto, las planteadas.</p>
        </div>
        <Button onClick={acciones.abrirCrear}>
          <Plus aria-hidden="true" />
          Nueva idea
        </Button>
      </header>
      <Aviso
        mensaje={confirmacion.mensaje}
        saliendo={confirmacion.saliendo}
        alCerrar={confirmacion.cerrar}
        alPausar={confirmacion.pausar}
        alReanudar={confirmacion.reanudar}
      />

      <Tarjeta titulo="Ideas">
        <div className="mb-4">
          <FiltrosIdeas filtros={filtros} alCambiar={setFiltros} proyectos={listaProyectos} objetivos={listaObjetivos} />
        </div>

        {ideas.isPending && <TextoVacio>Cargando ideas…</TextoVacio>}
        {ideas.error && <ErrorEnLinea mensaje={ideas.error.message} />}
        {acciones.error && (
          <div className="mb-3">
            <ErrorEnLinea mensaje={acciones.error} />
          </div>
        )}
        {(proyectos.isError || objetivos.isError) && (
          <p className="mb-2 text-xs text-mut">No se pudieron cargar los proyectos u objetivos: se muestran con su número.</p>
        )}
        {ideas.data?.length === 0 && <TextoVacio>Aún no tienes ideas.</TextoVacio>}
        {ideas.data && ideas.data.length > 0 && visibles?.length === 0 && (
          <TextoVacio>{textoVacioIdeas(filtros, { proyectos: proyectos.data, objetivos: objetivos.data })}</TextoVacio>
        )}
        {visibles && visibles.length > 0 && (
          <>
            <p className="mb-2 text-sm text-mut">
              {visibles.length} {visibles.length === 1 ? 'idea' : 'ideas'}
            </p>
            <ListaIdeas ideas={visibles} proyectos={proyectos.data} objetivos={objetivos.data} acciones={acciones} />
          </>
        )}
      </Tarjeta>

      <DialogosIdeas acciones={acciones} proyectos={listaProyectos} objetivos={listaObjetivos} />
    </div>
  )
}
