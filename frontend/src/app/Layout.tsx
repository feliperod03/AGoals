import { CalendarDays, FolderKanban, Lightbulb, Sun, Target, type LucideIcon } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@/lib/utils'

const SECCIONES: { ruta: string; texto: string; icono: LucideIcon }[] = [
  { ruta: '/', texto: 'Hoy', icono: Sun },
  { ruta: '/calendario', texto: 'Calendario', icono: CalendarDays },
  { ruta: '/proyectos', texto: 'Proyectos', icono: FolderKanban },
  { ruta: '/objetivos', texto: 'Objetivos', icono: Target },
  { ruta: '/ideas', texto: 'Ideas', icono: Lightbulb },
]

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
        <Outlet />
      </main>
    </div>
  )
}
