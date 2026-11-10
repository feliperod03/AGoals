import { describe, expect, it } from 'vitest'

import type { Recordatorio } from '@/types/recordatorio'
import { MAX_VENCIDOS_VISIBLES, partirVencidos } from './vencidos'

function lista(n: number): Recordatorio[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    tareaId: null,
    eventoId: null,
    fechaHora: '2026-11-10T08:00:00-03:00',
    canal: 'APP',
    enviado: false,
    descripcion: `R${i + 1}`,
  }))
}

describe('partirVencidos', () => {
  it('sin recordatorios no hay nada', () => {
    expect(partirVencidos([])).toEqual({ visibles: [], ocultos: 0 })
  })

  it('con exactamente el máximo no oculta ninguno', () => {
    const r = partirVencidos(lista(MAX_VENCIDOS_VISIBLES))
    expect(r.visibles).toHaveLength(MAX_VENCIDOS_VISIBLES)
    expect(r.ocultos).toBe(0)
  })

  it('con más, muestra los primeros en el orden del servidor y cuenta el resto', () => {
    const r = partirVencidos(lista(8))
    expect(r.visibles.map((x) => x.id)).toEqual([1, 2, 3, 4, 5])
    expect(r.ocultos).toBe(3)
  })
})
