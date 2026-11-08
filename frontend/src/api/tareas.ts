import type { Agenda } from '@/types/tarea'
import { get } from './client'

/** Agenda de un día (`fecha` = YYYY-MM-DD): tareas con hora y lista del día. */
export function getAgenda(fecha: string): Promise<Agenda> {
  return get<Agenda>('/api/tareas/agenda', { fecha })
}
