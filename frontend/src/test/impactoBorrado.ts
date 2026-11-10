import type { ImpactoBorradoObjetivo, ImpactoBorradoProyecto } from '@/types/impactoBorrado'

// Vistas previas de borrado de ejemplo para los tests de pantallas: sin nada que elegir (diálogo simple).

const VACIO = { total: 0, borrados: 0 }

export const SIN_DEPENDENCIAS_PROYECTO: ImpactoBorradoProyecto = { subproyectos: VACIO, tareas: VACIO, ideas: VACIO }

export const SIN_DEPENDENCIAS_OBJETIVO: ImpactoBorradoObjetivo = {
  subobjetivos: VACIO,
  proyectos: { ...VACIO, rescatados: 0 },
  tareas: VACIO,
  ideas: VACIO,
}
