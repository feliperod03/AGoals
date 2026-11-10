import type { Idea } from '@/types/idea'

/** Idea de prueba: planteada, suelta y sin conclusión, salvo lo que se indique. */
export function idea(parcial: Partial<Idea> = {}): Idea {
  return {
    id: 1,
    titulo: 'Idea',
    descripcion: null,
    estado: 'PLANTEADA',
    conclusion: null,
    proyectoId: null,
    objetivoId: null,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    fechaCierre: null,
    ...parcial,
  }
}
