import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'

import { IdeasPage } from '@/features/ideas/IdeasPage'

/** Renderiza la página de Ideas con un QueryClient sin reintentos. Los `vi.mock` de `@/api/...` van en cada test. */
export function renderizarIdeas() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <IdeasPage />
    </QueryClientProvider>,
  )
  return queryClient
}
