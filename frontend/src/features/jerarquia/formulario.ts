import type { Objetivo, ObjetivoRequest } from '@/types/objetivo'
import type { Proyecto, ProyectoRequest } from '@/types/proyecto'
import type { Estado, Prioridad } from '@/types/tarea'
import type { ItemJerarquico } from './tipos'

// Lógica pura del formulario de proyecto y objetivo (sin React): valores iniciales y cuerpo a enviar.
// El PUT del backend reemplaza todo: sin `estado` el elemento vuelve a PENDIENTE, y `padreId`, `objetivoId` y
// `prioridad` en null se borran. Por eso SIEMPRE se reenvían los seis campos.

export const MAX_NOMBRE = 150

/** Lo que maneja react-hook-form. Todo texto; '' = vacío. `objetivoId` '' = sin objetivo (solo proyectos). */
export interface ValoresItem {
  nombre: string
  descripcion: string
  estado: Estado
  prioridad: Prioridad | ''
  objetivoId: string
}

/** `original` ausente = formulario de creación (nace PENDIENTE). */
export function valoresIniciales(original?: ItemJerarquico & { objetivoId?: number | null }): ValoresItem {
  if (!original) return { nombre: '', descripcion: '', estado: 'PENDIENTE', prioridad: '', objetivoId: '' }
  return {
    nombre: original.nombre,
    // El backend guarda "" cuando no hay descripción.
    descripcion: original.descripcion ?? '',
    estado: original.estado,
    prioridad: original.prioridad ?? '',
    objetivoId: original.objetivoId != null ? String(original.objetivoId) : '',
  }
}

const vacioANull = (texto: string | undefined): string | null => (texto && texto.trim() !== '' ? texto : null)

function base(valores: Partial<ValoresItem>, original: ItemJerarquico | undefined, padreId: number | null | undefined) {
  return {
    nombre: (valores.nombre ?? '').trim(),
    descripcion: vacioANull(valores.descripcion),
    estado: valores.estado ?? original?.estado ?? ('PENDIENTE' as Estado),
    prioridad: (vacioANull(valores.prioridad) as Prioridad | null) ?? null,
    // `undefined` = campo "Padre" sin tocar: se reenvía el original (o ninguno al crear). `null` = sin padre.
    padreId: padreId === undefined ? (original?.padreId ?? null) : padreId,
  }
}

/** Cuerpo del formulario de objetivo. `padreId`: `undefined` = sin tocar, `null` = sin padre, número = nuevo padre. */
export function aRequestObjetivo(valores: Partial<ValoresItem>, original?: Objetivo, padreId?: number | null): ObjetivoRequest {
  return base(valores, original, padreId)
}

/** Cuerpo del formulario de proyecto. El objetivo sale de `valores.objetivoId` ('' = sin objetivo). */
export function aRequestProyecto(valores: Partial<ValoresItem>, original?: Proyecto, padreId?: number | null): ProyectoRequest {
  const objetivo = vacioANull(valores.objetivoId)
  return { ...base(valores, original, padreId), objetivoId: objetivo === null ? null : Number(objetivo) }
}

// --- Cambios rápidos (sin formulario): reenvían el elemento tal cual con un parche ---

export function requestObjetivoDe(objetivo: Objetivo, parche: Partial<ObjetivoRequest> = {}): ObjetivoRequest {
  return {
    nombre: objetivo.nombre,
    descripcion: vacioANull(objetivo.descripcion ?? undefined),
    estado: objetivo.estado,
    prioridad: objetivo.prioridad,
    padreId: objetivo.padreId,
    ...parche,
  }
}

export function requestProyectoDe(proyecto: Proyecto, parche: Partial<ProyectoRequest> = {}): ProyectoRequest {
  return {
    ...requestObjetivoDe(proyecto),
    objetivoId: proyecto.objetivoId,
    ...parche,
  }
}
