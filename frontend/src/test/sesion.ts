import type { QueryClient } from '@tanstack/react-query'

import type { Usuario } from '@/types/usuario'

export const USUARIO_PRUEBA: Usuario = { id: 1, nombreUsuario: 'felipe', email: 'felipe@agoals.local' }

/** Simula una sesión iniciada: deja `['sesion']` cargado, así el guard no consulta `/yo`. */
export function conSesion(queryClient: QueryClient, usuario: Usuario | null = USUARIO_PRUEBA) {
  queryClient.setQueryData(['sesion'], usuario)
}
