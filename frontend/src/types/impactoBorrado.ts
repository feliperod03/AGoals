// Vista previa y elecciones del borrado de proyectos y objetivos (ImpactoBorrado*Response del backend).

/** Qué hacer con una categoría de elementos al borrar: `conservar` = «Mover» en la interfaz. */
export type Eleccion = 'borrar' | 'conservar'

export type CategoriaProyecto = 'subproyectos' | 'tareas' | 'ideas'
export type CategoriaObjetivo = 'subobjetivos' | 'proyectos' | 'tareas' | 'ideas'
export type CategoriaBorrado = CategoriaProyecto | CategoriaObjetivo

/** Elecciones por categoría; las que faltan cuentan como `conservar`. */
export type Elecciones = Partial<Record<CategoriaBorrado, Eleccion>>

/**
 * `total` = elementos sobre los que se elige. `borrados` = filas que desaparecen con la elección actual,
 * incluidas las arrastradas (puede ser mayor que `total`); 0 si se conserva.
 */
export interface ConteoBorrado {
  total: number
  borrados: number
}

/** Proyectos de un objetivo: `rescatados` = los que se salvan por estar ligados a otro objetivo. */
export interface ConteoProyectosBorrado extends ConteoBorrado {
  rescatados: number
}

export interface ImpactoBorradoProyecto {
  subproyectos: ConteoBorrado
  tareas: ConteoBorrado
  ideas: ConteoBorrado
}

export interface ImpactoBorradoObjetivo {
  subobjetivos: ConteoBorrado
  proyectos: ConteoProyectosBorrado
  tareas: ConteoBorrado
  ideas: ConteoBorrado
}

/** Lo común a ambos: un conteo por categoría (`rescatados` solo viene en `proyectos` de un objetivo). */
export type ImpactoBorrado = Partial<Record<CategoriaBorrado, ConteoBorrado & { rescatados?: number }>>
