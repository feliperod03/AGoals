import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/client'
import { getRecordatoriosVencidos, marcarRecordatorioEnviado } from '@/api/recordatorios'
import { ahora } from '@/lib/fechas'
import { INTERVALO_VENCIDOS_MS } from './vencidos'

/**
 * Recordatorios vencidos y sin enviar. El instante NO va en la clave: `ahora()` se toma dentro de la `queryFn`,
 * así cada petición manda la hora real. Se repite cada 30 s (solo con la pestaña visible) y al volver a enfocarla.
 * Un fallo del polling no se muestra: el banner solo lee `data`, que se conserva entre errores.
 * Su clave cuelga de `['recordatorios']`, así que invalidar esa clave la refresca también.
 */
export function useRecordatoriosVencidos() {
  return useQuery({
    queryKey: ['recordatorios', 'vencidos'],
    queryFn: () => getRecordatoriosVencidos(ahora()),
    refetchInterval: INTERVALO_VENCIDOS_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}

/**
 * «Entendido»: marca un recordatorio como enviado. Una sola mutación a la vez; el guard es un `useRef` (no
 * `isPending`, que se actualiza en el siguiente render y dejaría pasar un doble clic) y se libera en `onSettled`,
 * o sea cuando terminó también el refresco. Éxito: invalida `['recordatorios']` (vencidos y Próximos de Hoy).
 * Error: el mensaje del servidor queda en `error` junto al id; con 404 (ya no existe) se refresca la lista.
 */
export function useMarcarEnviado() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<{ id: number; mensaje: string } | null>(null)
  const enCurso = useRef(false)
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['recordatorios'] })

  const mutacion = useMutation({
    mutationFn: (id: number) => marcarRecordatorioEnviado(id),
    onSuccess: refrescar,
    onError: async (e, id) => {
      setError({ id, mensaje: e.message })
      if (e instanceof ApiError && e.status === 404) await refrescar()
    },
    onSettled: () => {
      enCurso.current = false
    },
  })

  const marcar = (id: number) => {
    if (enCurso.current) return
    enCurso.current = true
    setError(null)
    mutacion.mutate(id)
  }

  return { marcar, pendiente: mutacion.isPending, error }
}
