import type { TareaRecomendada } from '@/types/tarea'

/** Cuenta los descendientes de todos los niveles. */
export function contarSubtareas(raiz: TareaRecomendada): number {
  return raiz.subtareas.reduce((total, hija) => total + 1 + contarSubtareas(hija), 0)
}
