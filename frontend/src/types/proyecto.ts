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

/**
 * Cuerpo de POST/PUT /api/proyectos (ProyectoRequest). El PUT reemplaza todo: si falta `estado` el
 * backend lo deja en PENDIENTE y si `padreId`/`objetivoId`/`prioridad` van en null se borran. Por eso
 * aquí todos los campos son obligatorios y se reenvían siempre.
 */
export interface ProyectoRequest {
  nombre: string
  descripcion: string | null
  estado: Estado
  prioridad: Prioridad | null
  padreId: number | null
  objetivoId: number | null
}
