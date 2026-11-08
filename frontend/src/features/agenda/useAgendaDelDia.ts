import { useQuery } from '@tanstack/react-query'

import { getAgenda } from '@/api/tareas'

/** Agenda de un día (`fecha` = YYYY-MM-DD). La clave incluye la fecha: cada día se cachea aparte. */
export function useAgendaDelDia(fecha: string) {
  return useQuery({
    queryKey: ['agenda', fecha],
    queryFn: () => getAgenda(fecha),
  })
}
