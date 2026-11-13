import { useQuery } from '@tanstack/react-query'

import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'

// Consulta neutral de las listas de proyectos y objetivos, para quien solo necesita nombrarlos o elegirlos
// (vincular tareas). No importa `config.ts` ni nada de `agenda/`: así `config.ts` puede usar las claves sin ciclos.

/** Claves de la lista completa. Son las mismas del Cofre y de las páginas de lista: comparten caché e invalidación. */
export const CLAVE_PROYECTOS = ['proyectos'] as const
export const CLAVE_OBJETIVOS = ['objetivos'] as const

export function useProyectos() {
  return useQuery({ queryKey: CLAVE_PROYECTOS, queryFn: getProyectos })
}

export function useObjetivos() {
  return useQuery({ queryKey: CLAVE_OBJETIVOS, queryFn: getObjetivos })
}
