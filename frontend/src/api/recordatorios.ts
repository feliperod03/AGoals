import type { Recordatorio } from '@/types/recordatorio'
import { del, get } from './client'

/** Todos los recordatorios, por fecha ascendente. */
export function getRecordatorios(): Promise<Recordatorio[]> {
  return get<Recordatorio[]>('/api/recordatorios')
}

/** Recordatorios de una tarea (como máximo uno). */
export function getRecordatoriosDeTarea(tareaId: number): Promise<Recordatorio[]> {
  return get<Recordatorio[]>('/api/recordatorios', { tareaId })
}

export function borrarRecordatorio(id: number): Promise<void> {
  return del(`/api/recordatorios/${id}`)
}
