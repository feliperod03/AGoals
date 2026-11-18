import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { alPerderSesion } from '@/api/client'
import { cerrarSesionLocal } from './limpiar'

/**
 * Sin interfaz. Escucha los 401 de `api/client.ts` (sesión vencida sin recordarme, o recordarme revocado):
 * limpia la caché y deja `['sesion']` en `null`, y el guard lleva a `/login?volver=…`.
 */
export function VigiaSesion() {
  const queryClient = useQueryClient()
  useEffect(() => alPerderSesion(() => cerrarSesionLocal(queryClient)), [queryClient])
  return null
}
