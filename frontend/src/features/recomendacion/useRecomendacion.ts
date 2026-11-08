import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { getRecomendacion } from '@/api/tareas'
import type { OrdenRecomendacion, SentidoOrden } from '@/types/tarea'

/** Un solo filtro a la vez: por proyecto o por objetivo (vínculo directo de la tarea). `null` = Todos. */
export type FiltroVinculo = { tipo: 'proyecto' | 'objetivo'; id: number } | null

/**
 * Tareas recomendadas para `hoy` y el estado de orden, sentido y filtro. La clave empieza por
 * `['tareas']`, así que la cubre la invalidación que ya hacen las demás mutaciones de tareas.
 * Los listados de proyectos y objetivos sirven para el selector y para rotular las filas.
 */
export function useRecomendacion(hoy: string) {
  const [orden, setOrden] = useState<OrdenRecomendacion>('prioridad')
  const [sentido, setSentido] = useState<SentidoOrden>('desc')
  const [filtro, setFiltro] = useState<FiltroVinculo>(null)

  const proyectoId = filtro?.tipo === 'proyecto' ? filtro.id : undefined
  const objetivoId = filtro?.tipo === 'objetivo' ? filtro.id : undefined

  const recomendacion = useQuery({
    queryKey: ['tareas', 'recomendacion', { fecha: hoy, orden, sentido, proyectoId, objetivoId }],
    queryFn: () => getRecomendacion({ fecha: hoy, orden, sentido, proyectoId, objetivoId }),
  })
  const proyectos = useQuery({ queryKey: ['proyectos'], queryFn: getProyectos })
  const objetivos = useQuery({ queryKey: ['objetivos'], queryFn: getObjetivos })

  return {
    orden,
    setOrden,
    sentido,
    invertirSentido: () => setSentido((s) => (s === 'desc' ? 'asc' : 'desc')),
    filtro,
    setFiltro,
    recomendacion,
    proyectos,
    objetivos,
  }
}
