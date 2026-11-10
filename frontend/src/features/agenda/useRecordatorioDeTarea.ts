import { useQuery } from '@tanstack/react-query'

import { getRecordatoriosDeTarea } from '@/api/recordatorios'

/**
 * El recordatorio de una tarea (como máximo uno). Misma clave que usa 8.2b al marcar hecha o cancelar, así que
 * comparte caché con esa consulta. `cargando` incluye los refrescos: mientras se refresca no se sabe si el
 * recordatorio sigue existiendo, y el diálogo no debe escribir a ciegas.
 */
export function useRecordatorioDeTarea(tareaId: number) {
  const consulta = useQuery({
    queryKey: ['recordatorios', { tareaId }],
    queryFn: () => getRecordatoriosDeTarea(tareaId),
    staleTime: 0,
    refetchOnMount: 'always',
  })
  return {
    recordatorio: consulta.data?.[0] ?? null,
    cargando: consulta.isPending || consulta.isFetching,
    fallo: consulta.isError && !consulta.isFetching,
    reintentar: () => void consulta.refetch(),
  }
}
