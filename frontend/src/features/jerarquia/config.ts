import { borrarObjetivo, actualizarObjetivo, crearObjetivo, getObjetivos } from '@/api/objetivos'
import { actualizarProyecto, borrarProyecto, crearProyecto, getProyectos } from '@/api/proyectos'
import type { Objetivo, ObjetivoRequest } from '@/types/objetivo'
import type { Proyecto, ProyectoRequest } from '@/types/proyecto'
import type { Estado } from '@/types/tarea'
import { aRequestObjetivo, aRequestProyecto, requestObjetivoDe, requestProyectoDe, type ValoresItem } from './formulario'
import type { ItemJerarquico } from './tipos'

/**
 * Todo lo que distingue a proyectos de objetivos para las pantallas compartidas de `features/jerarquia/`:
 * qué función de `api/` llamar, la clave de la consulta y los textos. `T` es el ítem y `R` su cuerpo de POST/PUT.
 */
export interface ConfigJerarquia<T extends ItemJerarquico, R> {
  /** Clave de la lista completa; es la misma que usa el Cofre (comparten caché). */
  claveLista: readonly string[]
  rutaBase: string
  /** «Proyecto»: para frases con mayúscula inicial. */
  etiqueta: string
  singular: string
  plural: string
  /** Título de la página: «Proyectos». */
  titulo: string
  descripcion: string
  listar: () => Promise<T[]>
  crear: (request: R) => Promise<T>
  actualizar: (id: number, request: R) => Promise<T>
  borrar: (id: number) => Promise<void>
  /** Cuerpo del formulario. `padreId`: `undefined` = sin tocar, `null` = sin padre, número = nuevo padre. */
  aRequest: (valores: Partial<ValoresItem>, original?: T, padreId?: number | null) => R
  /** Cuerpo del cambio rápido de estado: reenvía todo lo demás tal cual (el PUT reemplaza todo). */
  requestConEstado: (item: T, estado: Estado) => R
  textos: {
    cargando: string
    sinDatos: string
    sinCoincidencias: string
    /** «Subproyecto de»: va seguido del nombre del padre entre comillas angulares. */
    subDe: string
    /** «Proyecto principal»: detalle de un candidato a padre sin padre propio. */
    principal: string
    ocultoUno: string
    ocultoVarios: string
    /** Título de la sección de hijos directos del detalle: «Subproyectos». */
    hijos: string
    sinHijos: string
  }
}

export const CONFIG_PROYECTO: ConfigJerarquia<Proyecto, ProyectoRequest> = {
  claveLista: ['proyectos'],
  rutaBase: '/proyectos',
  etiqueta: 'Proyecto',
  singular: 'proyecto',
  plural: 'proyectos',
  titulo: 'Proyectos',
  descripcion: 'Tus proyectos, con sus subproyectos. Por defecto, los abiertos.',
  listar: getProyectos,
  crear: crearProyecto,
  actualizar: actualizarProyecto,
  borrar: borrarProyecto,
  aRequest: aRequestProyecto,
  requestConEstado: (p, estado) => requestProyectoDe(p, { estado }),
  textos: {
    cargando: 'Cargando tus proyectos…',
    sinDatos: 'Aún no tienes proyectos.',
    sinCoincidencias: 'Ningún proyecto coincide con los filtros.',
    subDe: 'Subproyecto de',
    principal: 'Proyecto principal',
    ocultoUno: 'subproyecto oculto',
    ocultoVarios: 'subproyectos ocultos',
    hijos: 'Subproyectos',
    sinHijos: 'Este proyecto no tiene subproyectos.',
  },
}

export const CONFIG_OBJETIVO: ConfigJerarquia<Objetivo, ObjetivoRequest> = {
  claveLista: ['objetivos'],
  rutaBase: '/objetivos',
  etiqueta: 'Objetivo',
  singular: 'objetivo',
  plural: 'objetivos',
  titulo: 'Objetivos',
  descripcion: 'Tus objetivos, con sus subobjetivos. Por defecto, los abiertos.',
  listar: getObjetivos,
  crear: crearObjetivo,
  actualizar: actualizarObjetivo,
  borrar: borrarObjetivo,
  aRequest: aRequestObjetivo,
  requestConEstado: (o, estado) => requestObjetivoDe(o, { estado }),
  textos: {
    cargando: 'Cargando tus objetivos…',
    sinDatos: 'Aún no tienes objetivos.',
    sinCoincidencias: 'Ningún objetivo coincide con los filtros.',
    subDe: 'Subobjetivo de',
    principal: 'Objetivo principal',
    ocultoUno: 'subobjetivo oculto',
    ocultoVarios: 'subobjetivos ocultos',
    hijos: 'Subobjetivos',
    sinHijos: 'Este objetivo no tiene subobjetivos.',
  },
}
