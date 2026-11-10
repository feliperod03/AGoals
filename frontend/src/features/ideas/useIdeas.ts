import { useQuery } from '@tanstack/react-query'

import { getIdeas } from '@/api/ideas'

/** Clave de la lista completa de ideas. `jerarquia/` la invalida con la misma clave escrita literal. */
export const CLAVE_IDEAS = ['ideas'] as const

/** La lista completa de ideas, sin filtros: la página filtra y ordena en el cliente (como Cofre y Proyectos). */
export function useIdeas() {
  return useQuery({ queryKey: CLAVE_IDEAS, queryFn: getIdeas })
}
