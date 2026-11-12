import { parseISO } from 'date-fns'

import { deFechaYHoraLocal, minutosEntre, partesLocales, sumarMinutos } from '@/lib/fechas'
import type { Recordatorio } from '@/types/recordatorio'

/**
 * Instante al que pasa el recordatorio de un evento cuando el evento cambia de inicio (9e, P7): se conserva la
 * DISTANCIA al inicio, `nuevo = recordatorio + (inicioNuevo − inicioViejo)`, en minutos.
 *
 * Devuelve `null` cuando no hay nada que mover: el recordatorio ya fue enviado, el inicio no cambió de instante
 * (se comparan con `getTime()`, no como texto: el mismo instante puede escribirse con otro desfase) o algún dato
 * es inválido. El resultado puede quedar en el pasado; eso no lo decide esta función.
 *
 * Los segundos del recordatorio se descartan (`partesLocales` trabaja en minutos); desde la UI siempre son `:00`.
 */
export function instanteMovido(recordatorio: Recordatorio, inicioViejo: string, inicioNuevo: string): string | null {
  if (recordatorio.enviado) return null
  const viejo = parseISO(inicioViejo).getTime()
  const nuevo = parseISO(inicioNuevo).getTime()
  const aviso = parseISO(recordatorio.fechaHora).getTime()
  // `partesLocales` lanza con una fecha inválida: se descarta antes.
  if (Number.isNaN(viejo) || Number.isNaN(nuevo) || Number.isNaN(aviso) || viejo === nuevo) return null
  const delta = minutosEntre(partesLocales(inicioViejo), partesLocales(inicioNuevo))
  if (delta === null || delta === 0) return null
  const punto = sumarMinutos(partesLocales(recordatorio.fechaHora), delta)
  return punto ? deFechaYHoraLocal(punto.fecha, punto.hora) : null
}
