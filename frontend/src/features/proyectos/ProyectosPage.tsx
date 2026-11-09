import { useMemo } from 'react'

import { CONFIG_OBJETIVO, CONFIG_PROYECTO } from '@/features/jerarquia/config'
import { PaginaLista } from '@/features/jerarquia/PaginaLista'
import { useListaJerarquia } from '@/features/jerarquia/useListaJerarquia'

/** Página Proyectos (8.4a): árbol de proyectos con su objetivo. */
export function ProyectosPage() {
  // La misma consulta del Cofre (`['objetivos']`); solo se usa para rotular el objetivo de cada proyecto.
  const objetivos = useListaJerarquia(CONFIG_OBJETIVO)
  const nombres = useMemo(() => new Map((objetivos.data ?? []).map((o) => [o.id, o.nombre])), [objetivos.data])

  return (
    <PaginaLista
      config={CONFIG_PROYECTO}
      extra={(p) => (p.objetivoId === null ? null : `Objetivo: ${nombres.get(p.objetivoId) ?? `n.º ${p.objetivoId}`}`)}
      objetivos={{ lista: objetivos.data, error: objetivos.isError }}
      nota={objetivos.error ? 'No se pudieron cargar los objetivos: se muestran con su número.' : undefined}
    />
  )
}
