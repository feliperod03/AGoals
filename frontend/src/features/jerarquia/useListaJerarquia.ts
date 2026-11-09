import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { armarArbolJerarquia } from './arbol'
import type { ConfigJerarquia } from './config'
import { FILTROS_POR_DEFECTO, filtrar, ordenar, type FiltrosLista } from './filtros'
import type { ItemJerarquico } from './tipos'

/** La lista completa de proyectos u objetivos. Misma clave que el Cofre: comparten caché y la misma invalidación. */
export function useListaJerarquia<T extends ItemJerarquico, R>(config: ConfigJerarquia<T, R>) {
  return useQuery({ queryKey: config.claveLista, queryFn: config.listar })
}

/**
 * Datos y estado de la página de lista: todos los ítems (sin filtrar en el servidor), filtros y árbol.
 * Filtra, ordena y arma el árbol en el cliente: el padre, los hijos ocultos y los nombres necesitan la lista completa.
 */
export function useVistaArbol<T extends ItemJerarquico, R>(config: ConfigJerarquia<T, R>) {
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_POR_DEFECTO)
  const lista = useListaJerarquia(config)

  const arbol = useMemo(() => {
    const todos = lista.data
    if (!todos) return undefined
    const filtrados = ordenar(filtrar(todos, filtros))
    return { total: filtrados.length, nodos: armarArbolJerarquia(todos, filtrados) }
  }, [lista.data, filtros])

  return { lista, filtros, setFiltros, volverALaVistaPorDefecto: () => setFiltros(FILTROS_POR_DEFECTO), arbol }
}
