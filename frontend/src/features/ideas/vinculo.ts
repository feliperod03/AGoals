import { nombreDe } from '@/features/jerarquia/candidatosVinculo'
import type { Idea } from '@/types/idea'

type Nombres = readonly { id: number; nombre: string }[] | undefined

/** Texto del vínculo de una idea: «Proyecto: X», «Objetivo: Y» o «Suelta». Con la lista sin cargar, «n.º N». */
export function textoVinculo(idea: Idea, proyectos: Nombres, objetivos: Nombres): string {
  if (idea.proyectoId !== null) return `Proyecto: ${nombreDe(proyectos, idea.proyectoId)}`
  if (idea.objetivoId !== null) return `Objetivo: ${nombreDe(objetivos, idea.objetivoId)}`
  return 'Suelta'
}
