export type EstadoIdea = 'PLANTEADA' | 'CONCLUIDA'

// IdeaResponse del backend. Las dos fechas son OffsetDateTime ISO con desfase.
export interface Idea {
  id: number
  titulo: string
  descripcion: string | null
  estado: EstadoIdea
  conclusion: string | null
  proyectoId: number | null
  objetivoId: number | null
  fechaCreacion: string
  fechaCierre: string | null
}

/**
 * Cuerpo de POST/PUT /api/ideas (IdeaRequest). El PUT reemplaza todo: un campo que no se reenvía queda vacío
 * (suelta el vínculo y borra la conclusión). Por eso aquí todos los campos son obligatorios y se mandan siempre.
 * Proyecto y objetivo a la vez = 400 en el backend.
 */
export interface IdeaRequest {
  titulo: string
  descripcion: string | null
  proyectoId: number | null
  objetivoId: number | null
  conclusion: string | null
}
