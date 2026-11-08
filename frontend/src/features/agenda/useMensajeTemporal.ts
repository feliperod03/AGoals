import { useCallback, useEffect, useRef, useState } from 'react'

/** Mensaje que desaparece solo a los `ms` milisegundos. El temporizador se cancela al desmontar y al mostrar otro mensaje. */
export function useMensajeTemporal(ms = 6000) {
  const [mensaje, setMensaje] = useState('')
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const mostrar = useCallback(
    (texto: string) => {
      clearTimeout(temporizador.current)
      setMensaje(texto)
      temporizador.current = setTimeout(() => setMensaje(''), ms)
    },
    [ms],
  )

  return { mensaje, mostrar }
}
