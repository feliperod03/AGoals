import { Archive, CalendarDays, FolderKanban, Lightbulb, Monitor, Moon, Sun, Target, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { AvisoVencidos } from '@/features/agenda/AvisoVencidos'
import { cn } from '@/lib/utils'
import type { Preferencia } from './tema'
import { siguientePreferencia } from './tema'
import { useTema } from './useTema'

const SECCIONES: { ruta: string; texto: string; icono: LucideIcon }[] = [
  { ruta: '/', texto: 'Hoy', icono: Sun },
  { ruta: '/cofre', texto: 'Cofre', icono: Archive },
  { ruta: '/calendario', texto: 'Calendario', icono: CalendarDays },
  { ruta: '/proyectos', texto: 'Proyectos', icono: FolderKanban },
  { ruta: '/objetivos', texto: 'Objetivos', icono: Target },
  { ruta: '/ideas', texto: 'Ideas', icono: Lightbulb },
]

const TEMAS: Record<Preferencia, { texto: string; icono: LucideIcon }> = {
  sistema: { texto: 'Sistema', icono: Monitor },
  claro: { texto: 'Claro', icono: Sun },
  oscuro: { texto: 'Oscuro', icono: Moon },
}

/** Botón que cicla Sistema → Claro → Oscuro; el texto visible es el estado actual. */
function BotonTema() {
  const { preferencia, ciclar } = useTema()
  const { texto, icono: Icono } = TEMAS[preferencia]
  return (
    <button
      type="button"
      onClick={ciclar}
      aria-label={`Tema: ${texto}. Cambiar a ${TEMAS[siguientePreferencia(preferencia)].texto}`}
      className="ml-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-mut transition-colors hover:bg-line/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none max-md:h-11"
    >
      <Icono className="size-4" aria-hidden="true" />
      {texto}
    </button>
  )
}

/**
 * Marco de la app. Responsive solo con CSS: en pantallas anchas (md+) la barra es
 * una columna fija a la izquierda; en pantallas angostas pasa a ser una franja
 * horizontal arriba (con scroll si no cabe), sin menú desplegable.
 */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-side md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center gap-3 px-5 pt-4 md:pt-6">
          <span className="font-serif text-2xl font-semibold text-tx">AGoals</span>
          <BotonTema />
        </div>
        <nav aria-label="Secciones" className="flex gap-1 overflow-x-auto p-3 [scrollbar-width:none] md:flex-col md:p-4">
          {SECCIONES.map(({ ruta, texto, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              end={ruta === '/'}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-3 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive ? 'bg-acc text-acc-tx' : 'text-tx hover:bg-line/60',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icono className={cn('size-4', isActive ? 'text-acc-tx' : 'text-gold')} aria-hidden="true" />
                  {texto}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <AvisoVencidos />
        <Outlet />
      </main>
    </div>
  )
}
