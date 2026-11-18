import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { get } from '@/api/client'
import { conSesion, USUARIO_PRUEBA } from '@/test/sesion'
import { VigiaSesion } from './VigiaSesion'

afterEach(() => vi.unstubAllGlobals())

function montar() {
  const queryClient = new QueryClient()
  conSesion(queryClient)
  queryClient.setQueryData(['tareas', 'todas'], [{ id: 1 }])
  // StrictMode monta, desmonta y vuelve a montar: debe quedar exactamente un oyente.
  const vista = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <VigiaSesion />
      </QueryClientProvider>
    </StrictMode>,
  )
  return { queryClient, vista }
}

async function provocar401() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{"mensaje":"Inicia sesión para continuar","errores":[]}', { status: 401 })))
  await get('/api/tareas').catch(() => undefined)
}

describe('VigiaSesion', () => {
  it('ante un 401 deja la sesión en null y borra los demás datos', async () => {
    const { queryClient } = montar()
    expect(queryClient.getQueryData(['sesion'])).toEqual(USUARIO_PRUEBA)
    await provocar401()
    expect(queryClient.getQueryData(['sesion'])).toBeNull()
    expect(queryClient.getQueryData(['tareas', 'todas'])).toBeUndefined()
  })

  it('al desmontarse deja de escuchar', async () => {
    const { queryClient, vista } = montar()
    vista.unmount()
    await provocar401()
    expect(queryClient.getQueryData(['sesion'])).toEqual(USUARIO_PRUEBA)
    expect(queryClient.getQueryData(['tareas', 'todas'])).toEqual([{ id: 1 }])
  })
})
