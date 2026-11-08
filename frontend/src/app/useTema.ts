import { useEffect } from 'react'

/**
 * Aplica el modo oscuro siguiendo la preferencia del sistema.
 *
 * Los tokens oscuros de index.css cuelgan de la clase `.dark` en <html>. Este efecto:
 *  1. consulta `matchMedia('(prefers-color-scheme: dark)')`,
 *  2. pone o quita `.dark` según `matches` (`classList.toggle(clase, forzar)`),
 *  3. escucha `change` para reaccionar si el usuario cambia el tema del sistema con la app abierta,
 *  4. quita el listener al desmontar.
 * Más adelante, un selector manual solo tendría que escribir esa misma clase.
 */
export function useTema() {
  useEffect(() => {
    const preferenciaOscura = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => document.documentElement.classList.toggle('dark', preferenciaOscura.matches)

    aplicar()
    preferenciaOscura.addEventListener('change', aplicar)
    return () => preferenciaOscura.removeEventListener('change', aplicar)
  }, [])
}
