import type { Estado, Prioridad } from './tarea'

// ProyectoResponse del backend.
export interface Proyecto {
  id: number
  nombre: string
  descripcion: string | null
  estado: Estado
  prioridad: Prioridad | null
  padreId: number | null
  objetivoId: number | null
  fechaCreacion: string
}
