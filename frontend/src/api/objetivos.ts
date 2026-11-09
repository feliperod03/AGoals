import type { Objetivo, ObjetivoRequest } from '@/types/objetivo'
import { del, get, post, put } from './client'

/** Todos los objetivos, sin filtros (las pantallas filtran y arman el árbol en el cliente). */
export function getObjetivos(): Promise<Objetivo[]> {
  return get<Objetivo[]>('/api/objetivos')
}

export function crearObjetivo(request: ObjetivoRequest): Promise<Objetivo> {
  return post<Objetivo>('/api/objetivos', request)
}

/** El PUT reemplaza todo el objetivo: quien llama debe reenviar todos los campos (ver `ObjetivoRequest`). */
export function actualizarObjetivo(id: number, request: ObjetivoRequest): Promise<Objetivo> {
  return put<Objetivo>(`/api/objetivos/${id}`, request)
}

/** 409 con mensaje legible si tiene subobjetivos, proyectos, tareas o ideas: el backend nunca borra en cascada. */
export function borrarObjetivo(id: number): Promise<void> {
  return del(`/api/objetivos/${id}`)
}
