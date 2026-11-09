import type { Objetivo } from '@/types/objetivo'
import type { Proyecto } from '@/types/proyecto'

/** Proyecto de prueba: pendiente, sin prioridad, sin padre ni objetivo, salvo lo que se indique. */
export function proyecto(parcial: Partial<Proyecto> = {}): Proyecto {
  return {
    id: 1,
    nombre: 'Proyecto',
    descripcion: '',
    estado: 'PENDIENTE',
    prioridad: null,
    padreId: null,
    objetivoId: null,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}

/** Objetivo de prueba: pendiente, sin prioridad y sin padre, salvo lo que se indique. */
export function objetivo(parcial: Partial<Objetivo> = {}): Objetivo {
  return {
    id: 1,
    nombre: 'Objetivo',
    descripcion: '',
    estado: 'PENDIENTE',
    prioridad: null,
    padreId: null,
    fechaCreacion: '2026-11-01T10:00:00-03:00',
    ...parcial,
  }
}
