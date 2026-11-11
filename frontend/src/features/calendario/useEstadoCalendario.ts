import { useSearchParams } from 'react-router-dom'

import { limitesDeSemana, mesDe } from '@/lib/fechas'
import { estadoDesdeUrl, semanaDesdeUrl, vistaDesdeUrl, type Vista } from './calendario'

/** Dos búsquedas son la misma URL aunque los parámetros vengan en otro orden. */
function mismaBusqueda(a: URLSearchParams, b: URLSearchParams): boolean {
  const ordenada = (p: URLSearchParams) => {
    const copia = new URLSearchParams(p)
    copia.sort()
    return copia.toString()
  }
  return ordenada(a) === ordenada(b)
}

/**
 * Vista, mes y día del calendario, guardados en la URL para que recargar y «atrás» funcionen:
 * - mes (9a, por defecto): `?mes=2026-11&dia=2026-11-10`;
 * - semana (9b): `?vista=semana&dia=2026-11-10` (la semana es la que contiene ese día).
 * Se derivan en cada render (un valor inválido cae al valor por defecto, sin reescribir la URL).
 * Regla: lo que cambia de vista, de mes o de semana hace push; mover el día dentro de lo visible hace replace.
 * Un push que llevaría a la misma URL se hace con replace (si no, «Hoy» pulsado varias veces apilaría entradas).
 */
export function useEstadoCalendario(hoy: string) {
  const [params, setParams] = useSearchParams()
  const vista = vistaDesdeUrl(params.get('vista'))
  const delMes = estadoDesdeUrl(params.get('mes'), params.get('dia'), hoy)
  const deSemana = semanaDesdeUrl(params.get('dia'), hoy)
  const dia = vista === 'semana' ? deSemana.dia : delMes.dia

  function ir(valores: Record<string, string>, replace = false) {
    const siguiente = new URLSearchParams(valores)
    setParams(siguiente, { replace: replace || mismaBusqueda(siguiente, params) })
  }
  const enSemana = (fecha: string) => ({ vista: 'semana', dia: fecha })

  return {
    vista,
    /** Mes de la cuadrícula (solo tiene sentido en la vista mensual). */
    mes: delMes.mes,
    dia,
    /** Lunes de la semana visible (solo en la vista semanal). */
    lunes: limitesDeSemana(deSemana.dia).lunes,
    /** Otro mes (‹ › del mes): push, sin `dia` (el día por defecto del mes nuevo lo decide `estadoDesdeUrl`). */
    irAMes: (nuevoMes: string) => ir({ mes: nuevoMes }),
    /** Otra semana (‹ › de la semana): push con ese día. */
    irASemana: (fecha: string) => ir(enSemana(fecha)),
    /** «Hoy»: push de hoy en la vista actual (replace si ya se estaba ahí). */
    irAHoy: () => ir(vista === 'semana' ? enSemana(hoy) : { mes: mesDe(hoy), dia: hoy }),
    /** Un día visible (clic o tecla que no sale de lo visible): replace. */
    seleccionarDia: (fecha: string) => ir(vista === 'semana' ? enSemana(fecha) : { mes: delMes.mes, dia: fecha }, true),
    /** Un día fuera de lo visible (teclado): push con el mes o la semana de ese día. */
    saltarADia: (fecha: string) => ir(vista === 'semana' ? enSemana(fecha) : { mes: mesDe(fecha), dia: fecha }),
    /** Cambio de vista: push; el día seleccionado viaja a la otra vista. */
    cambiarVista: (nueva: Vista) => {
      if (nueva === vista) return
      ir(nueva === 'semana' ? enSemana(dia) : { mes: mesDe(dia), dia })
    },
  }
}
