import { useQuery } from '@tanstack/react-query'

import { getRecordatorios } from '@/api/recordatorios'
import { getTarea } from '@/api/tareas'
import type { Recordatorio } from '@/types/recordatorio'
import { proximosRecordatorios, tituloRecordatorio } from './proximos'
import { useEvento } from './useEventos'

/** Los próximos 3 recordatorios sin enviar (el filtro se hace en el cliente: la API no lo ofrece). */
export function useProximosRecordatorios(ahora: Date) {
  return useQuery({
    queryKey: ['recordatorios'],
    queryFn: getRecordatorios,
    select: (lista) => proximosRecordatorios(lista, ahora),
  })
}

/**
 * Texto de un recordatorio. Si no trae descripción, consulta el título de su tarea o evento
 * (`RecordatorioResponse` solo trae los ids); mientras llega, o si falla, queda un texto genérico.
 */
export function useTituloRecordatorio(r: Recordatorio): string {
  const sinDescripcion = !r.descripcion || r.descripcion.trim() === ''
  const tarea = useQuery({
    queryKey: ['tareas', r.tareaId],
    queryFn: () => getTarea(r.tareaId as number),
    enabled: sinDescripcion && r.tareaId !== null,
  })
  const evento = useEvento(sinDescripcion ? r.eventoId : null)
  return tituloRecordatorio(r, tarea.data?.titulo ?? evento.data?.titulo)
}
