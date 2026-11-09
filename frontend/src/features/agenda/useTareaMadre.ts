import { useQuery } from '@tanstack/react-query'

import { getTarea } from '@/api/tareas'

/**
 * Título de la tarea madre (para mostrar "Subtarea de «X»" al editar). Si no hay `padreId`, o la carga
 * falla (404, red), devuelve `undefined` y el diálogo simplemente no muestra la línea.
 */
export function useTareaMadre(padreId: number | null | undefined): string | undefined {
  const madre = useQuery({
    queryKey: ['tareas', padreId],
    queryFn: () => getTarea(padreId as number),
    enabled: padreId != null,
  })
  return madre.data?.titulo
}
