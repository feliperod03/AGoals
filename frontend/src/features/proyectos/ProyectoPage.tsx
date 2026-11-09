import { Link, useParams } from 'react-router-dom'

import { CONFIG_OBJETIVO, CONFIG_PROYECTO } from '@/features/jerarquia/config'
import { PaginaDetalle } from '@/features/jerarquia/PaginaDetalle'
import { TareasLigadas } from '@/features/jerarquia/TareasLigadas'
import { useListaJerarquia } from '@/features/jerarquia/useListaJerarquia'

/** Detalle de un proyecto (8.4a): datos, subproyectos y tareas ligadas (solo lectura). */
export function ProyectoPage() {
  const { id } = useParams()
  // La misma consulta del Cofre y de la lista (`['objetivos']`): rotula el objetivo y alimenta el formulario de edición.
  const objetivos = useListaJerarquia(CONFIG_OBJETIVO)

  return (
    <PaginaDetalle
      config={CONFIG_PROYECTO}
      idParam={id}
      objetivos={{ lista: objetivos.data, error: objetivos.isError }}
      datosExtra={(p) => (
        <>
          <dt className="text-mut">Objetivo</dt>
          <dd>
            {p.objetivoId === null ? (
              'Sin objetivo'
            ) : (
              <Link
                to={`/objetivos/${p.objetivoId}`}
                className="rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {objetivos.data?.find((o) => o.id === p.objetivoId)?.nombre ?? `n.º ${p.objetivoId}`}
              </Link>
            )}
          </dd>
        </>
      )}
      secciones={(p) => (
        <TareasLigadas campo="proyectoId" id={p.id} titulo="Tareas ligadas" textoVacio="Este proyecto no tiene tareas ligadas." />
      )}
    />
  )
}
