import { useQuery } from '@tanstack/react-query'

import { yo } from '@/api/auth'
import { ApiError } from '@/api/client'
import type { Usuario } from '@/types/usuario'
import { CLAVE_SESION } from './limpiar'

/**
 * El usuario de la sesión, o `null` si no hay (un 401 de `/yo` es «sin sesión», no un error). Otros fallos
 * (red, 5xx) sí son error: no significan que la sesión haya terminado.
 */
export function useSesion() {
  return useQuery<Usuario | null>({
    queryKey: CLAVE_SESION,
    queryFn: async () => {
      try {
        return await yo()
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: Infinity,
    retry: false,
  })
}
