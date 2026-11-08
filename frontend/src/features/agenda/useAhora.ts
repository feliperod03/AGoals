import { useEffect, useState } from 'react'

import { aFechaLocal } from '@/lib/fechas'

const UN_MINUTO_MS = 60_000

/**
 * Reloj de la página: el instante actual (se actualiza cada minuto) y el día local de hoy.
 * Al volver a enfocar la pestaña se recalcula al instante, así Hoy cambia de día aunque
 * la pestaña haya quedado abierta de la noche a la mañana.
 */
export function useAhora(): { ahora: Date; hoy: string } {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    const actualizar = () => setAhora(new Date())
    const alVolver = () => {
      if (document.visibilityState === 'visible') actualizar()
    }
    const timer = setInterval(actualizar, UN_MINUTO_MS)
    window.addEventListener('focus', actualizar)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', actualizar)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  return { ahora, hoy: aFechaLocal(ahora) }
}
