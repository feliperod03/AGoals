import type { Recordatorio } from '@/types/recordatorio'
import { del, get, patch } from './client'

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

/** No enviados con fecha <= `ahora` (ISO con desfase, lo manda el cliente), por fecha e id. */
export function getRecordatoriosVencidos(ahora: string): Promise<Recordatorio[]> {
  return get<Recordatorio[]>('/api/recordatorios/vencidos', { ahora })
}

/** Marca el recordatorio como enviado (sin cuerpo, idempotente; 404 si no existe). */
export function marcarRecordatorioEnviado(id: number): Promise<Recordatorio> {
  return patch<Recordatorio>(`/api/recordatorios/${id}/marcar-enviado`)
}
