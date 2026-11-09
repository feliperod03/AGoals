import type { Tarea } from '@/types/tarea'

/** Tarea de prueba: sin fecha, pendiente y suelta, salvo lo que se indique. */
export function tarea(parcial: Partial<Tarea> = {}): Tarea {
  return {
    id: 1,
    titulo: 'Tarea',
    descripcion: null,
    estado: 'PENDIENTE',
    prioridad: null,
    fecha: null,
    horaInicio: null,
    horaFin: null,
    padreId: null,
    proyectoId: null,
    objetivoId: null,
    vecesPospuesta: 0,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}
