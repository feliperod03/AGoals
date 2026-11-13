import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type { Proyecto } from '@/types/proyecto'
import { SelectorObjetivo } from './SelectorObjetivo'
import type { ItemJerarquico } from './tipos'

vi.mock('@/api/proyectos', async (original) => ({ ...(await original<object>()), actualizarProyecto: vi.fn() }))

const PROYECTO: Proyecto = {
  id: 1,
  nombre: 'Mudanza',
  descripcion: null,
  estado: 'PENDIENTE',
  prioridad: null,
  padreId: null,
  objetivoId: 9,
  fechaCreacion: '2026-01-01T10:00:00Z',
}

const objetivo = (id: number, nombre: string): ItemJerarquico => ({ id, nombre, estado: 'PENDIENTE', padreId: null }) as ItemJerarquico

function renderizar(lista: ItemJerarquico[] | undefined, error = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SelectorObjetivo proyecto={PROYECTO} objetivos={{ lista, error }} alMensaje={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return screen.getByRole('combobox', { name: 'Objetivo de «Mudanza»' }) as HTMLSelectElement
}

describe('SelectorObjetivo', () => {
  it('con el objetivo en la lista muestra su nombre y lo deja elegido', () => {
    const select = renderizar([objetivo(9, 'Mudarme')])
    expect(select.value).toBe('9')
    expect(screen.getByRole('option', { name: 'Mudarme' })).toBeInTheDocument()
  })

  it('con la lista cargada pero sin ese objetivo, conserva el valor y lo marca «no disponible»', () => {
    const select = renderizar([objetivo(3, 'Otro')])
    expect(select.value).toBe('9')
    expect(screen.getByRole('option', { name: 'Objetivo n.º 9 (no disponible)' })).toBeInTheDocument()
  })

  it('si la lista no cargó, conserva el valor con su número, sin decir «no disponible»', () => {
    const select = renderizar(undefined, true)
    expect(select.value).toBe('9')
    expect(screen.getByRole('option', { name: 'Objetivo n.º 9' })).toBeInTheDocument()
  })
})
