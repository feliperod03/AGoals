import { useCallback, useEffect, useState } from 'react'

import { esOscuro, guardarPreferencia, leerPreferencia, siguientePreferencia, type Preferencia } from './tema'

/**
 * Tema de la app. Los tokens oscuros de index.css cuelgan de la clase `.dark` en <html>. Este hook:
 *  1. parte de la preferencia guardada (`agoals:tema`) o, sin ella, del sistema;
 *  2. pone o quita `.dark` según la preferencia efectiva;
 *  3. solo si se sigue al sistema, escucha `change` de `prefers-color-scheme` (cambios en vivo) y lo quita al desmontar;
 *  4. `ciclar` pasa Sistema → Claro → Oscuro → Sistema y guarda la elección.
 * El script de `index.html` hace lo mismo antes del primer render para que no parpadee.
 */
export function useTema() {
  const [preferencia, setPreferencia] = useState<Preferencia>(leerPreferencia)

  useEffect(() => {
    const sistema = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => document.documentElement.classList.toggle('dark', esOscuro(preferencia, sistema.matches))

    aplicar()
    if (preferencia !== 'sistema') return
    sistema.addEventListener('change', aplicar)
    return () => sistema.removeEventListener('change', aplicar)
  }, [preferencia])

  const ciclar = useCallback(() => {
    const siguiente = siguientePreferencia(preferencia)
    guardarPreferencia(siguiente)
    setPreferencia(siguiente)
  }, [preferencia])

  return { preferencia, ciclar }
}
