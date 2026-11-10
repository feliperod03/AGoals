import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { Elecciones } from '@/types/impactoBorrado'
import { eleccionesNormalizadas } from './borrado'
import type { ConfigJerarquia } from './config'
import type { ItemJerarquico } from './tipos'

/** Raíz de las claves de la vista previa. Aparte de `['proyectos']`/`['objetivos']` a propósito (ver `useImpactoBorrado`). */
export const CLAVE_IMPACTO_BORRADO = 'impacto-borrado'

/**
 * Vista previa del borrado: se pide al abrir el diálogo y de nuevo cada vez que cambia una elección.
 *
 * - La clave lleva tipo, id y las elecciones completas (una por categoría), así dos estados iguales comparten consulta.
 * - `keepPreviousData`: mientras llega la respuesta de la nueva elección se sigue mostrando la anterior (sin parpadeo);
 *   en ese lapso `isPlaceholderData` es true y quien llama NO debe dejar confirmar.
 * - Sin caché útil: `staleTime: 0` y `gcTime` corto, porque los conteos cambian apenas se toca cualquier dato.
 * - La clave no cuelga de `['proyectos']`: así `invalidarJerarquia` no la refresca, y no se pide la vista previa de
 *   un elemento que se acaba de borrar (daría 404).
 */
export function useImpactoBorrado<T extends ItemJerarquico, R>(config: ConfigJerarquia<T, R>, id: number, elecciones: Elecciones) {
  const normalizadas = eleccionesNormalizadas(elecciones, config.categoriasBorrado)
  return useQuery({
    queryKey: [CLAVE_IMPACTO_BORRADO, config.claveLista[0], id, normalizadas],
    queryFn: () => config.impactoBorrado(id, normalizadas),
    placeholderData: keepPreviousData,
    staleTime: 0,
    gcTime: 5_000,
    retry: false,
  })
}
