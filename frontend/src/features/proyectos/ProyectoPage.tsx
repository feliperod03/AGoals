import { useParams } from 'react-router-dom'

import { IdeasLigadas } from '@/features/ideas/IdeasLigadas'
import { CONFIG_OBJETIVO, CONFIG_PROYECTO } from '@/features/jerarquia/config'
import { PaginaDetalle } from '@/features/jerarquia/PaginaDetalle'
import { SelectorObjetivo } from '@/features/jerarquia/SelectorObjetivo'
import { esAbierto } from '@/features/jerarquia/tipos'
import { TareasLigadas } from '@/features/jerarquia/TareasLigadas'
import { useListaJerarquia } from '@/features/jerarquia/useListaJerarquia'

/** Detalle de un proyecto (8.4a): datos, subproyectos y tareas ligadas (8.4b: quitar y vincular); el objetivo se cambia ahí mismo (8.4a2). */
export function ProyectoPage() {
  const { id } = useParams()
  // La misma consulta del Cofre y de la lista (`['objetivos']`): rotula el objetivo y alimenta el formulario de edición.
  const objetivos = useListaJerarquia(CONFIG_OBJETIVO)
  const disponibles = { lista: objetivos.data, error: objetivos.isError }

  return (
    <PaginaDetalle
      config={CONFIG_PROYECTO}
      idParam={id}
      objetivos={disponibles}
      datosExtra={(p, { alMensaje }) => (
        <>
          <dt className="text-mut">Objetivo</dt>
          <dd>
            <SelectorObjetivo proyecto={p} objetivos={disponibles} alMensaje={alMensaje} />
          </dd>
        </>
      )}
      secciones={(p, contexto) => (
        <>
          <TareasLigadas
            campo="proyectoId"
            id={p.id}
            titulo="Tareas ligadas"
            textoVacio="Este proyecto no tiene tareas ligadas."
            nombre={p.nombre}
            abierto={esAbierto(p.estado)}
            alMensaje={contexto.alMensaje}
          />
          <IdeasLigadas campo="proyectoId" id={p.id} />
        </>
      )}
    />
  )
}
