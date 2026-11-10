import { useSearchParams } from 'react-router-dom'

import { mesDe } from '@/lib/fechas'
import { estadoDesdeUrl } from './calendario'

/**
 * Mes y día seleccionados, guardados en la URL (`?mes=2026-11&dia=2026-11-10`) para que recargar y «atrás» funcionen.
 * Se derivan en cada render (un valor inválido cae al valor por defecto, sin reescribir la URL).
 * Regla: lo que cambia el mes hace push; lo que solo cambia el día dentro de la cuadrícula visible hace replace.
 */
export function useEstadoCalendario(hoy: string) {
  const [params, setParams] = useSearchParams()
  const { mes, dia } = estadoDesdeUrl(params.get('mes'), params.get('dia'), hoy)

  return {
    mes,
    dia,
    /** Otro mes (‹ ›): push, sin `dia` (el día por defecto del mes nuevo lo decide `estadoDesdeUrl`). */
    irAMes: (nuevoMes: string) => setParams({ mes: nuevoMes }),
    /** «Hoy»: push del mes actual con hoy seleccionado. */
    irAHoy: () => setParams({ mes: mesDe(hoy), dia: hoy }),
    /** Un día de la cuadrícula visible: replace, el mes no cambia. */
    seleccionarDia: (fecha: string) => setParams({ mes, dia: fecha }, { replace: true }),
    /** Un día fuera de la cuadrícula visible (teclado): push con el mes de ese día. */
    saltarADia: (fecha: string) => setParams({ mes: mesDe(fecha), dia: fecha }),
  }
}
