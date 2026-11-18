import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { login } from '@/api/auth'
import { CLAVE_SESION, limpiarDatos, olvidarSalidaVoluntaria } from './limpiar'
import { volverSeguro } from './volver'

/**
 * Entrar: al éxito se descarta todo dato anterior (para no mezclar cuentas), se fija `['sesion']` y se va a
 * `volver` (validado) o a «/».
 */
export function useLogin() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const volver = params.get('volver')

  return useMutation({
    mutationFn: login,
    onSuccess: (usuario) => {
      olvidarSalidaVoluntaria()
      limpiarDatos(queryClient)
      queryClient.setQueryData(CLAVE_SESION, usuario)
      navigate(volverSeguro(volver), { replace: true })
    },
  })
}
