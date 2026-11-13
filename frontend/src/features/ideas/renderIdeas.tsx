import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { IdeasPage } from '@/features/ideas/IdeasPage'

/**
 * Renderiza la página de Ideas con un QueryClient sin reintentos y un router en memoria (la página lee `?proyecto=`
 * / `?objetivo=`; `ruta` permite probarlo). Los `vi.mock` de `@/api/...` van en cada test.
 */
export function renderizarIdeas(ruta = '/ideas') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <IdeasPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return queryClient
}
