import { useParams } from 'react-router-dom'

import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { CONFIG_OBJETIVO, CONFIG_PROYECTO } from '@/features/jerarquia/config'
import { ListaEnlaces } from '@/features/jerarquia/ListaEnlaces'
import { PaginaDetalle } from '@/features/jerarquia/PaginaDetalle'
import { TareasLigadas } from '@/features/jerarquia/TareasLigadas'
import { ordenar } from '@/features/jerarquia/filtros'
import { useListaJerarquia } from '@/features/jerarquia/useListaJerarquia'

/** Detalle de un objetivo (8.4a): datos, subobjetivos, sus proyectos y las tareas ligadas directamente (solo lectura). */
export function ObjetivoPage() {
  const { id } = useParams()
  return (
    <PaginaDetalle
      config={CONFIG_OBJETIVO}
      idParam={id}
      secciones={(o) => (
        <>
          <ProyectosDelObjetivo objetivoId={o.id} />
          <TareasLigadas
            campo="objetivoId"
            id={o.id}
            titulo="Tareas ligadas directamente"
            aclaracion="Las tareas de sus proyectos se ven en cada proyecto."
            textoVacio="Este objetivo no tiene tareas ligadas directamente."
          />
        </>
      )}
    />
  )
}

/** Los proyectos con `objetivoId` = este objetivo (de la misma lista que usa la página Proyectos). */
function ProyectosDelObjetivo({ objetivoId }: { objetivoId: number }) {
  const proyectos = useListaJerarquia(CONFIG_PROYECTO)
  const propios = ordenar((proyectos.data ?? []).filter((p) => p.objetivoId === objetivoId))
  return (
    <Tarjeta titulo="Proyectos del objetivo">
      {proyectos.isPending && <TextoVacio>{CONFIG_PROYECTO.textos.cargando}</TextoVacio>}
      {proyectos.error && <ErrorEnLinea mensaje={proyectos.error.message} />}
      {proyectos.data && propios.length === 0 && <TextoVacio>Este objetivo no tiene proyectos.</TextoVacio>}
      {propios.length > 0 && <ListaEnlaces items={propios} rutaBase={CONFIG_PROYECTO.rutaBase} />}
    </Tarjeta>
  )
}
