import type { Recordatorio, RecordatorioRequest } from '@/types/recordatorio'
import { del, get, patch, post, put } from './client'

/** Crea un recordatorio (201). 409 si la tarea o el evento ya tiene uno. */
export function crearRecordatorio(req: RecordatorioRequest): Promise<Recordatorio> {
  return post<Recordatorio>('/api/recordatorios', req)
}

/** Reemplaza el recordatorio completo (el cuerpo lleva los cinco campos). Si cambia el instante, `enviado` vuelve a false. */
export function actualizarRecordatorio(id: number, req: RecordatorioRequest): Promise<Recordatorio> {
  return put<Recordatorio>(`/api/recordatorios/${id}`, req)
}

/** Todos los recordatorios, por fecha ascendente. */
export function getRecordatorios(): Promise<Recordatorio[]> {
  return get<Recordatorio[]>('/api/recordatorios')
}

/** Recordatorios de una tarea (como máximo uno). */
export function getRecordatoriosDeTarea(tareaId: number): Promise<Recordatorio[]> {
  return get<Recordatorio[]>('/api/recordatorios', { tareaId })
}

/** Recordatorios de un evento (como máximo uno). Con un id que no existe responde `[]`, no 400. */
export function getRecordatoriosDeEvento(eventoId: number): Promise<Recordatorio[]> {
  return get<Recordatorio[]>('/api/recordatorios', { eventoId })
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
