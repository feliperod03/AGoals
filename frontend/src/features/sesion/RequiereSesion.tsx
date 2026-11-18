import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ErrorEnLinea } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { esSalidaVoluntaria } from './limpiar'
import { PantallaCargando } from './PantallaCargando'
import { useSesion } from './useSesion'
import { rutaParaVolver, urlLogin } from './volver'

/**
 * Guard de rutas: no monta nada hasta que `/yo` responda. Sin sesión lleva a `/login?volver=<ruta actual>`.
 * Si `/yo` falla por red o por el servidor, ofrece reintentar en vez de mandar a /login (con el backend caído
 * el login tampoco funcionaría).
 */
export function RequiereSesion({ children }: { children?: ReactNode }) {
  const sesion = useSesion()
  const ubicacion = useLocation()

  if (sesion.data === null) {
    return <Navigate replace to={esSalidaVoluntaria() ? '/login' : urlLogin(rutaParaVolver(ubicacion))} />
  }
  if (sesion.data === undefined) {
    if (!sesion.isError) return <PantallaCargando />
    return (
      <div className="grid min-h-screen place-items-center bg-bg p-4">
        <div className="flex w-full max-w-sm flex-col gap-4">
          <h1 className="font-serif text-2xl text-tx">No se pudo comprobar la sesión</h1>
          <ErrorEnLinea mensaje={sesion.error.message} />
          <Button onClick={() => void sesion.refetch()} disabled={sesion.isFetching}>
            {sesion.isFetching ? 'Reintentando…' : 'Reintentar'}
          </Button>
        </div>
      </div>
    )
  }
  return children ?? <Outlet />
}
