import { useCallback, useEffect, useRef, useState } from 'react'

/** Duración de la fase de salida (la animación CSS dura lo mismo). Se mide con un temporizador, no con `transitionend`. */
export const SALIDA_MS = 200
/** Al reanudar tras una pausa, el aviso queda visible al menos este tiempo. */
const MINIMO_TRAS_PAUSA_MS = 2000

/**
 * Mensaje que desaparece solo a los `ms` milisegundos, con una fase de salida (`saliendo`) de `SALIDA_MS`
 * para que la animación tenga tiempo. Un mensaje nuevo reemplaza al anterior. Se puede pausar (hover o foco).
 * Los temporizadores se cancelan al desmontar.
 */
export function useMensajeTemporal(ms = 6000) {
  const [mensaje, setMensaje] = useState('')
  const [saliendo, setSaliendo] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Cuándo vence el temporizador de visibilidad (para calcular lo que falta al pausar).
  const vence = useRef(0)
  const restante = useRef(ms)
  // Espejo de `mensaje` para leerlo en `reanudar` sin efectos dentro de un actualizador de estado.
  const hayMensaje = useRef(false)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const salir = useCallback(() => {
    clearTimeout(temporizador.current)
    setSaliendo(true)
    temporizador.current = setTimeout(() => {
      hayMensaje.current = false
      setMensaje('')
      setSaliendo(false)
    }, SALIDA_MS)
  }, [])

  const programar = useCallback(
    (duracion: number) => {
      clearTimeout(temporizador.current)
      restante.current = duracion
      vence.current = Date.now() + duracion
      temporizador.current = setTimeout(salir, duracion)
    },
    [salir],
  )

  const mostrar = useCallback(
    (texto: string) => {
      hayMensaje.current = texto !== ''
      setMensaje(texto)
      setSaliendo(false)
      programar(ms)
    },
    [ms, programar],
  )

  /** Cierra ya (botón «×»): salta directo a la fase de salida. */
  const cerrar = useCallback(() => salir(), [salir])

  /** Detiene el temporizador (y revierte una salida en curso) mientras el puntero o el foco están en el aviso. */
  const pausar = useCallback(() => {
    clearTimeout(temporizador.current)
    restante.current = Math.max(vence.current - Date.now(), 0)
    setSaliendo(false)
  }, [])

  const reanudar = useCallback(() => {
    // Sin mensaje no hay nada que reanudar (evita arrancar un temporizador de un aviso ya cerrado).
    if (hayMensaje.current) programar(Math.max(restante.current, MINIMO_TRAS_PAUSA_MS))
  }, [programar])

  return { mensaje, saliendo, mostrar, cerrar, pausar, reanudar }
}
