import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { DialogosAcciones } from '@/features/agenda/DialogosAcciones'
import { puedeAgendarParaHoy } from '@/features/agenda/formularioTarea'
import { TareaDialog } from '@/features/agenda/TareaDialog'
import { useAccionesTarea } from '@/features/agenda/useAccionesTarea'
import { useAgendarTarea } from '@/features/agenda/useAgendarTarea'
import { useAhora } from '@/features/agenda/useAhora'
import { useMensajeTemporal } from '@/features/agenda/useMensajeTemporal'
import type { Tarea } from '@/types/tarea'
import { AgendarDialog } from './AgendarDialog'
import { subtareasCandidatas } from './arbol'
import { hayFiltrosActivos } from './filtros'
import { ListaCofre } from './ListaCofre'
import { PanelFiltros } from './PanelFiltros'
import { useCofre } from './useCofre'

/**
 * Página Cofre (rebanada 8.3b): inventario de todas las tareas con filtros, orden y subtareas anidadas.
 * Por defecto muestra las abiertas sin fecha. Reutiliza las acciones rápidas de Hoy y agrega "Agendar para hoy".
 */
export function CofrePage() {
  const { hoy } = useAhora()
  const cofre = useCofre(hoy)
  // `{}` = diálogo para crear; `{ tarea }` = para editar; `null` = cerrado.
  const [dialogo, setDialogo] = useState<{ tarea?: Tarea } | null>(null)
  const [aAgendar, setAAgendar] = useState<{ tarea: Tarea; candidatas: number } | null>(null)
  const confirmacion = useMensajeTemporal()
  const acciones = useAccionesTarea({
    alMensaje: confirmacion.mostrar,
    alTerminar: (tareaId) => setDialogo((actual) => (actual?.tarea?.id === tareaId ? null : actual)),
  })
  const agendar = useAgendarTarea({ hoy, alAgendar: confirmacion.mostrar })

  const proyectos = useMemo(() => new Map((cofre.proyectos.data ?? []).map((p) => [p.id, p.nombre])), [cofre.proyectos.data])
  const objetivos = useMemo(() => new Map((cofre.objetivos.data ?? []).map((o) => [o.id, o.nombre])), [cofre.objetivos.data])
  const errorListados = cofre.proyectos.error?.message ?? cofre.objetivos.error?.message ?? null
  // Mientras se agenda también se bloquean las demás acciones.
  const accionesOcupadas = { ...acciones, pendiente: acciones.pendiente || agendar.isPending }

  function pedirAgendar(tarea: Tarea) {
    agendar.reset()
    const candidatas = subtareasCandidatas(tarea, cofre.tareas.data ?? [], hoy).length
    // Sin subtareas candidatas no hay nada que preguntar: se agenda directo y un error sale en el cartel de la página.
    if (candidatas === 0) agendar.mutate({ tarea, incluirSubtareas: false })
    else setAAgendar({ tarea, candidatas })
  }

  const confirmarAgendar = (tarea: Tarea, incluirSubtareas: boolean) =>
    agendar.mutate({ tarea, incluirSubtareas }, { onSuccess: () => setAAgendar(null) })

  const filtrando = hayFiltrosActivos(cofre.filtros)

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">Cofre</h1>
          <p className="mt-1 text-sm text-mut">Todas tus tareas, con filtros. Por defecto, las abiertas que aún no tienen fecha.</p>
        </div>
        <Button onClick={() => setDialogo({})}>
          <Plus aria-hidden="true" />
          Nueva tarea
        </Button>
      </header>
      {/* Región viva: el lector de pantalla anuncia la confirmación de cada acción. */}
      <p role="status" aria-live="polite" className={confirmacion.mensaje ? '-mt-3 mb-4 text-sm text-tx' : 'sr-only'}>
        {confirmacion.mensaje}
      </p>

      <Tarjeta titulo="Tareas">
        <div className="mb-4">
          <PanelFiltros
            filtros={cofre.filtros}
            alCambiarFiltros={cofre.setFiltros}
            alVolverALaVistaPorDefecto={cofre.volverALaVistaPorDefecto}
            orden={cofre.orden}
            sentido={cofre.sentido}
            alCambiarOrden={cofre.setOrden}
            alInvertirSentido={cofre.invertirSentido}
            anclados={cofre.anclados}
            alCambiarAnclados={cofre.cambiarAnclados}
            proyectos={cofre.proyectos.data}
            objetivos={cofre.objetivos.data}
            errorListados={errorListados}
          />
        </div>

        {cofre.tareas.isPending && <TextoVacio>Cargando tus tareas…</TextoVacio>}
        {cofre.tareas.error && <ErrorEnLinea mensaje={cofre.tareas.error.message} />}
        {acciones.error && (
          <div className="mb-3">
            <ErrorEnLinea mensaje={acciones.error} />
          </div>
        )}
        {agendar.error && !aAgendar && (
          <div className="mb-3">
            <ErrorEnLinea mensaje={agendar.error.message} />
          </div>
        )}
        {cofre.arbol && cofre.arbol.filtradas.length === 0 && (
          <TextoVacio>{filtrando ? 'Ninguna tarea coincide con los filtros.' : 'No hay tareas sin fecha.'}</TextoVacio>
        )}
        {cofre.arbol && cofre.arbol.filtradas.length > 0 && (
          <>
            <p className="mb-2 text-sm text-mut">
              {cofre.arbol.filtradas.length} {cofre.arbol.filtradas.length === 1 ? 'tarea' : 'tareas'}
            </p>
            <ListaCofre
              nodos={cofre.arbol.nodos}
              hoy={hoy}
              proyectos={proyectos}
              objetivos={objetivos}
              acciones={accionesOcupadas}
              alEditar={(tarea) => setDialogo({ tarea })}
              alAgendar={pedirAgendar}
              puedeAgendar={(tarea) => puedeAgendarParaHoy(tarea, hoy)}
            />
          </>
        )}
      </Tarjeta>

      <TareaDialog abierto={dialogo} alCerrar={() => setDialogo(null)} alGuardar={confirmacion.mostrar} acciones={acciones} />
      <AgendarDialog
        abierto={aAgendar}
        pendiente={agendar.isPending}
        error={agendar.error?.message ?? null}
        alConfirmar={confirmarAgendar}
        alCerrar={() => {
          setAAgendar(null)
          agendar.reset()
        }}
      />
      <DialogosAcciones acciones={acciones} hoy={hoy} />
    </div>
  )
}
