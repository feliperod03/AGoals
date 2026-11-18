import type { QueryClient } from '@tanstack/react-query'

export const CLAVE_SESION = ['sesion'] as const

const noEsSesion = (q: { queryKey: readonly unknown[] }) => q.queryKey[0] !== CLAVE_SESION[0]

/**
 * Equivale a `queryClient.clear()` pero conserva `['sesion']`: con `clear()` el observador del guard queda
 * colgado de una query que ya no está en la caché y no se entera del `setQueryData` posterior. No queda
 * ningún dato del usuario anterior (queries ni mutaciones), así que no se mezclan datos entre cuentas.
 */
export function limpiarDatos(queryClient: QueryClient) {
  void queryClient.cancelQueries({ predicate: noEsSesion })
  queryClient.removeQueries({ predicate: noEsSesion })
  queryClient.getMutationCache().clear()
}

// Salida pedida por el usuario («Salir»). El guard la consulta para no añadir `volver` a /login: al navegar, el
// router aplica su estado un instante después de que `['sesion']` pasa a null, y el guard vería la ruta vieja.
// Se apaga al montarse la pantalla de login y tras un login correcto.
let salidaVoluntaria = false

export function marcarSalidaVoluntaria() {
  salidaVoluntaria = true
}

export function esSalidaVoluntaria() {
  return salidaVoluntaria
}

export function olvidarSalidaVoluntaria() {
  salidaVoluntaria = false
}

/** Sesión terminada (logout o 401): se borran los datos y `['sesion']` pasa a `null`, que el guard convierte en `/login`. */
export function cerrarSesionLocal(queryClient: QueryClient) {
  limpiarDatos(queryClient)
  queryClient.setQueryData(CLAVE_SESION, null)
}
