import { CONFIG_OBJETIVO } from '@/features/jerarquia/config'
import { PaginaLista } from '@/features/jerarquia/PaginaLista'

/** Página Objetivos (8.4a): árbol de objetivos. */
export function ObjetivosPage() {
  return <PaginaLista config={CONFIG_OBJETIVO} />
}
