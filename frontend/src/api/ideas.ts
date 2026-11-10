import type { Idea, IdeaRequest } from '@/types/idea'
import { del, get, patch, post, put } from './client'

/** Todas las ideas, sin filtros (la pantalla filtra y ordena en el cliente). */
export function getIdeas(): Promise<Idea[]> {
  return get<Idea[]>('/api/ideas')
}

export function crearIdea(request: IdeaRequest): Promise<Idea> {
  return post<Idea>('/api/ideas', request)
}

/** El PUT reemplaza toda la idea: quien llama debe reenviar los cinco campos (ver `IdeaRequest`). No cambia el estado. */
export function actualizarIdea(id: number, request: IdeaRequest): Promise<Idea> {
  return put<Idea>(`/api/ideas/${id}`, request)
}

/**
 * Concluye la idea. Una conclusión no vacía reemplaza la existente; vacía o ausente conserva la anterior (en ese
 * caso no se manda cuerpo). 409 si ya estaba concluida.
 */
export function concluirIdea(id: number, conclusion?: string): Promise<Idea> {
  const texto = conclusion?.trim()
  return patch<Idea>(`/api/ideas/${id}/concluir`, texto ? { conclusion: texto } : undefined)
}

/** Vuelve a PLANTEADA conservando la conclusión. Idempotente. */
export function reabrirIdea(id: number): Promise<Idea> {
  return patch<Idea>(`/api/ideas/${id}/reabrir`)
}

/** 204 directo, sin 409. */
export function borrarIdea(id: number): Promise<void> {
  return del(`/api/ideas/${id}`)
}
