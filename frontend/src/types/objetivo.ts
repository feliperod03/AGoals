import type { Estado, Prioridad } from './tarea'

// ObjetivoResponse del backend (como Proyecto, sin `objetivoId`).
export interface Objetivo {
  id: number
  nombre: string
  descripcion: string | null
  estado: Estado
  prioridad: Prioridad | null
  padreId: number | null
  fechaCreacion: string
}
