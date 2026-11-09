import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'
import { useTodasLasTareas } from '@/features/agenda/useTodasLasTareas'
import { guardarAnclados, leerAnclados } from './anclados'
import { armarArbol } from './arbol'
import {
  FILTROS_POR_DEFECTO,
  SENTIDO_NATURAL,
  filtrar,
  ordenar,
  type FiltrosCofre,
  type OrdenCofre,
  type PresetId,
  type SentidoCofre,
} from './filtros'

/**
 * Datos y estado del Cofre: todas las tareas (la clave empieza por `['tareas']`, así la cubre la
 * invalidación de cualquier cambio de tareas), filtros, orden y accesos rápidos. Filtra, ordena y
 * arma el árbol en el cliente.
 */
export function useCofre(hoy: string) {
  const [filtros, setFiltros] = useState<FiltrosCofre>(FILTROS_POR_DEFECTO)
  const [orden, setOrdenActual] = useState<OrdenCofre>('prioridad')
  const [sentido, setSentido] = useState<SentidoCofre>(SENTIDO_NATURAL.prioridad)
  const [anclados, setAnclados] = useState<PresetId[]>(leerAnclados)

  const tareas = useTodasLasTareas()
  const proyectos = useQuery({ queryKey: ['proyectos'], queryFn: getProyectos })
  const objetivos = useQuery({ queryKey: ['objetivos'], queryFn: getObjetivos })

  const arbol = useMemo(() => {
    const todas = tareas.data
    if (!todas) return undefined
    const filtradas = ordenar(filtrar(todas, filtros, hoy), orden, sentido)
    return { filtradas, nodos: armarArbol(todas, filtradas) }
  }, [tareas.data, filtros, hoy, orden, sentido])

  return {
    filtros,
    setFiltros,
    volverALaVistaPorDefecto: () => setFiltros(FILTROS_POR_DEFECTO),
    orden,
    /** Al cambiar de orden el sentido vuelve al natural de ese orden. */
    setOrden: (nuevo: OrdenCofre) => {
      setOrdenActual(nuevo)
      setSentido(SENTIDO_NATURAL[nuevo])
    },
    sentido,
    invertirSentido: () => setSentido((s) => (s === 'asc' ? 'desc' : 'asc')),
    anclados,
    cambiarAnclados: (ids: PresetId[]) => {
      setAnclados(ids)
      guardarAnclados(ids)
    },
    tareas,
    proyectos,
    objetivos,
    arbol,
  }
}
