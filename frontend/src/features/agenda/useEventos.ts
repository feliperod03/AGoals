import { useQuery } from '@tanstack/react-query'

import { getEvento, getEventos } from '@/api/eventos'
import { ahora, rangoDelDia } from '@/lib/fechas'

/** Eventos que tocan el día `fecha` (YYYY-MM-DD). Los que cruzan la medianoche se recortan al mostrarlos. */
export function useEventosDelDia(fecha: string) {
  return useQuery({
    queryKey: ['eventos', 'dia', fecha],
    queryFn: () => getEventos(rangoDelDia(fecha)),
  })
}

/** Eventos desde este momento en adelante (sin tope); la página muestra los 3 primeros. */
export function useProximosEventos() {
  return useQuery({
    queryKey: ['eventos', 'proximos'],
    // El "ahora" se toma al pedir, no forma parte de la clave: así no se pide de nuevo cada minuto.
    queryFn: () => getEventos({ desde: ahora() }),
    select: (eventos) => eventos.slice(0, 3),
  })
}

export function useEvento(id: number | null) {
  return useQuery({
    queryKey: ['eventos', id],
    queryFn: () => getEvento(id as number),
    enabled: id !== null,
  })
}
