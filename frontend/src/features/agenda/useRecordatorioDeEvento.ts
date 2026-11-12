import { useQuery } from '@tanstack/react-query'

import { getRecordatoriosDeEvento } from '@/api/recordatorios'

/**
 * El recordatorio de un evento (como máximo uno), gemelo de `useRecordatorioDeTarea`. Clave
 * `['recordatorios', { eventoId }]`: cualquier invalidación de `['recordatorios']` la cubre. `cargando` incluye los
 * refrescos: mientras se refresca no se sabe si el recordatorio sigue existiendo.
 */
export function useRecordatorioDeEvento(eventoId: number) {
  const consulta = useQuery({
    queryKey: ['recordatorios', { eventoId }],
    queryFn: () => getRecordatoriosDeEvento(eventoId),
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
