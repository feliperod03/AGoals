import type { CandidataBuscador } from '@/components/BuscadorLista'
import type { Proyecto } from '@/types/proyecto'
import { porNombre } from './candidatosPadre'
import { esAbierto, type ItemJerarquico } from './tipos'

/**
 * Proyectos que se pueden vincular al objetivo `objetivoId`: los abiertos que no son ya suyos. Si el proyecto
 * tiene otro objetivo, la fila avisa que se moverá (un proyecto tiene un solo objetivo). El nombre del otro
 * objetivo sale de `objetivos`; si esa lista no cargó se muestra con su número. Orden por nombre.
 */
export function candidatosProyectoParaObjetivo(
  objetivoId: number,
  proyectos: Proyecto[],
  objetivos: ItemJerarquico[] | undefined,
): CandidataBuscador<Proyecto>[] {
  return proyectos
    .filter((p) => esAbierto(p.estado) && p.objetivoId !== objetivoId)
    .sort(porNombre)
    .map((p) => {
      const otro = p.objetivoId === null ? undefined : (objetivos?.find((o) => o.id === p.objetivoId)?.nombre ?? `n.º ${p.objetivoId}`)
      return { item: p, texto: p.nombre, detalle: otro === undefined ? 'Sin objetivo' : `Ahora es del objetivo «${otro}»; se moverá` }
    })
}
