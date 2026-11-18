import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { logout } from '@/api/auth'
import { cerrarSesionLocal, marcarSalidaVoluntaria } from './limpiar'

/**
 * Salir: POST logout y, salga bien o mal, se limpia todo y se va a /login (sin `volver`: el guard lo sabe por
 * `marcarSalidaVoluntaria`).
 */
export function useSalir() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      marcarSalidaVoluntaria()
      navigate('/login', { replace: true })
      cerrarSesionLocal(queryClient)
    },
  })
}
