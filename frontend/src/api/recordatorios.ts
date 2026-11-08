import type { Recordatorio } from '@/types/recordatorio'
import { get } from './client'

/** Todos los recordatorios, por fecha ascendente. */
export function getRecordatorios(): Promise<Recordatorio[]> {
  return get<Recordatorio[]>('/api/recordatorios')
}
