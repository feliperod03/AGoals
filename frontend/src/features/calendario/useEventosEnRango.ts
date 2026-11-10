import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getEventos } from '@/api/eventos'

/**
 * Eventos que se solapan con el rango `[desde, hasta)` (ISO con desfase, ver `rangoDeFechas`). La clave
 * `['eventos', 'rango', desde, hasta]` no choca con `['eventos', 'dia', f]`, `['eventos', 'proximos']` ni
 * `['eventos', id]`, y cualquier invalidación de `['eventos']` la cubre.
 *
 * `keepPreviousData` (como `useImpactoBorrado`): al cambiar de mes se siguen mostrando los eventos anteriores
 * hasta que llega la respuesta. Mientras tanto `isPlaceholderData` es true.
 */
export function useEventosEnRango(rango: { desde: string; hasta: string }) {
  return useQuery({
    queryKey: ['eventos', 'rango', rango.desde, rango.hasta],
    queryFn: () => getEventos(rango),
    placeholderData: keepPreviousData,
  })
}
