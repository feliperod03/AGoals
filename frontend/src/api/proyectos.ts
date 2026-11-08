import type { Proyecto } from '@/types/proyecto'
import { get } from './client'

export function getProyectos(): Promise<Proyecto[]> {
  return get<Proyecto[]>('/api/proyectos')
}
