import type { Recordatorio } from '@/types/recordatorio'

export const CANTIDAD_PROXIMOS = 3

/** No enviados con fecha ≥ ahora, por fecha ascendente, los primeros `limite`. Compara instantes, no texto. */
export function proximosRecordatorios(
  recordatorios: Recordatorio[],
  ahora: Date,
  limite: number = CANTIDAD_PROXIMOS,
): Recordatorio[] {
  return recordatorios
    .map((r) => ({ r, instante: new Date(r.fechaHora).getTime() }))
    .filter(({ r, instante }) => !r.enviado && instante >= ahora.getTime())
    .sort((a, b) => a.instante - b.instante || a.r.id - b.r.id)
    .slice(0, limite)
    .map(({ r }) => r)
}

/**
 * Texto de un recordatorio. La API no trae el título de la tarea/evento: se usa la descripción si
 * hay; si no, el título que se haya podido consultar; si no, un texto genérico.
 */
export function tituloRecordatorio(r: Recordatorio, tituloVinculado?: string): string {
  if (r.descripcion && r.descripcion.trim() !== '') return r.descripcion
  if (tituloVinculado) return tituloVinculado
  if (r.tareaId !== null) return 'Recordatorio de una tarea'
  if (r.eventoId !== null) return 'Recordatorio de un evento'
  return 'Recordatorio'
}
