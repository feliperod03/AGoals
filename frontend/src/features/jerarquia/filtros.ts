import { normalizarTexto } from '@/lib/texto'
import type { Estado, Prioridad } from '@/types/tarea'
import { esAbierto, type ItemJerarquico } from './tipos'

// Lógica pura de la lista de proyectos y objetivos (sin React): filtros y orden.

/** `abiertos` = PENDIENTE, EN_PROGRESO y EN_PAUSA; `todos` = sin restricción; o un estado concreto. */
export type FiltroEstado = 'abiertos' | 'todos' | Estado

export interface FiltrosLista {
  estado: FiltroEstado
  busqueda: string
}

export const FILTROS_POR_DEFECTO: FiltrosLista = { estado: 'abiertos', busqueda: '' }

export function hayFiltrosActivos(f: FiltrosLista): boolean {
  return f.estado !== FILTROS_POR_DEFECTO.estado || f.busqueda.trim() !== ''
}

/** ¿Un ítem en ese estado se ve con el filtro de estado? (La búsqueda por nombre no depende del estado.) */
export function cumpleEstado(estado: Estado, filtro: FiltroEstado): boolean {
  if (filtro === 'todos') return true
  if (filtro === 'abiertos') return esAbierto(estado)
  return estado === filtro
}

/** Estado y búsqueda por nombre (sin mayúsculas ni tildes) se combinan con AND. Conserva el orden de entrada. */
export function filtrar<T extends ItemJerarquico>(items: T[], f: FiltrosLista): T[] {
  const texto = normalizarTexto(f.busqueda.trim())
  return items.filter((i) => cumpleEstado(i.estado, f.estado) && (texto === '' || normalizarTexto(i.nombre).includes(texto)))
}

const RANGO_PRIORIDAD: Record<Prioridad, number> = { BAJA: 1, MEDIA: 2, ALTA: 3 }

/** Prioridad (alta primero, sin prioridad al final), luego nombre sin tildes ni mayúsculas, desempate por id. */
export function ordenar<T extends ItemJerarquico>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pa = a.prioridad ? RANGO_PRIORIDAD[a.prioridad] : 0
    const pb = b.prioridad ? RANGO_PRIORIDAD[b.prioridad] : 0
    if (pa !== pb) return pb - pa
    return normalizarTexto(a.nombre).localeCompare(normalizarTexto(b.nombre), 'es') || a.id - b.id
  })
}
