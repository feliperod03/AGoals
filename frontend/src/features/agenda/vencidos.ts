import type { Recordatorio } from '@/types/recordatorio'

/** Cada cuánto se pregunta por recordatorios vencidos (con la pestaña visible). */
export const INTERVALO_VENCIDOS_MS = 30_000
/** Filas que muestra el banner; el resto se resume en «+N más pendientes». */
export const MAX_VENCIDOS_VISIBLES = 5

/**
 * Variable CSS (en `<html>`) con el alto del banner mientras está a la vista. Las cabeceras fijas de la semana la usan
 * como su `top` para quedar justo debajo, en vez de esconderse detrás (H-36). Sin banner no está definida (= 0).
 */
export const VARIABLE_ALTO_VENCIDOS = '--alto-vencidos'

/** Primeros `MAX_VENCIDOS_VISIBLES` en el orden del servidor y cuántos quedan sin mostrar. */
export function partirVencidos(
  vencidos: Recordatorio[],
  max: number = MAX_VENCIDOS_VISIBLES,
): { visibles: Recordatorio[]; ocultos: number } {
  return { visibles: vencidos.slice(0, max), ocultos: Math.max(0, vencidos.length - max) }
}
