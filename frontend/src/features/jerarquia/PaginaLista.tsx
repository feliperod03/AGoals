import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Aviso } from '@/components/Aviso'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { useMensajeTemporal } from '@/features/agenda/useMensajeTemporal'
import type { ConfigJerarquia } from './config'
import { DialogosJerarquia } from './DialogosJerarquia'
import { FiltrosLista } from './FiltrosLista'
import type { ObjetivosDisponibles } from './ItemDialog'
import { ListaArbol } from './ListaArbol'
import type { ItemJerarquico } from './tipos'
import { useAccionesJerarquia } from './useAccionesJerarquia'
import { useVistaArbol } from './useListaJerarquia'

interface Props<T extends ItemJerarquico, R> {
  config: ConfigJerarquia<T, R>
  /** Texto extra de la línea secundaria de cada fila (p. ej. el objetivo de un proyecto). */
  extra?: (item: T) => string | null
  /** Aviso discreto sobre la lista (p. ej. si no cargaron los objetivos). */
  nota?: string
  /** Solo proyectos: los objetivos entre los que elegir en el formulario. */
  objetivos?: ObjetivosDisponibles
}

/** Aviso que dejó otra pantalla al navegar hasta esta (p. ej. el detalle tras borrar), en el `state` del router. */
function avisoPendiente(state: unknown): string | null {
  if (typeof state === 'object' && state !== null && 'aviso' in state && typeof state.aviso === 'string') return state.aviso
  return null
}

/**
 * Página de lista compartida por Proyectos y Objetivos: filtros y árbol con estados de carga, error y vacío,
 * crear / editar / borrar, cambio rápido de estado y aviso flotante.
 */
export function PaginaLista<T extends ItemJerarquico, R>({ config, extra, nota, objetivos }: Props<T, R>) {
  const { lista, filtros, setFiltros, volverALaVistaPorDefecto, arbol } = useVistaArbol(config)
  const confirmacion = useMensajeTemporal()
  const acciones = useAccionesJerarquia(config, { alMensaje: confirmacion.mostrar, filtroEstado: filtros.estado })
  const { textos } = config

  // Aviso que llega desde el detalle (borrar vuelve a la lista): se muestra una vez y se limpia del historial.
  const location = useLocation()
  const navigate = useNavigate()
  const pendiente = avisoPendiente(location.state)
  const { mostrar } = confirmacion
  useEffect(() => {
    if (pendiente === null) return
    mostrar(pendiente)
    void navigate(location.pathname, { replace: true, state: null })
  }, [pendiente, mostrar, navigate, location.pathname])

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">{config.titulo}</h1>
          <p className="mt-1 text-sm text-mut">{config.descripcion}</p>
        </div>
        <Button onClick={acciones.abrirCrear}>
          <Plus aria-hidden="true" />
          Nuevo {config.singular}
        </Button>
      </header>
      <Aviso
        mensaje={confirmacion.mensaje}
        saliendo={confirmacion.saliendo}
        alCerrar={confirmacion.cerrar}
        alPausar={confirmacion.pausar}
        alReanudar={confirmacion.reanudar}
      />

      <Tarjeta titulo={config.titulo}>
        <div className="mb-4">
          <FiltrosLista filtros={filtros} alCambiar={setFiltros} alVolverALaVistaPorDefecto={volverALaVistaPorDefecto} />
        </div>

        {lista.isPending && <TextoVacio>{textos.cargando}</TextoVacio>}
        {lista.error && <ErrorEnLinea mensaje={lista.error.message} />}
        {acciones.error && (
          <div className="mb-3">
            <ErrorEnLinea mensaje={acciones.error} />
          </div>
        )}
        {nota && <p className="mb-2 text-xs text-mut">{nota}</p>}
        {arbol && lista.data?.length === 0 && <TextoVacio>{textos.sinDatos}</TextoVacio>}
        {arbol && lista.data && lista.data.length > 0 && arbol.total === 0 && <TextoVacio>{textos.sinCoincidencias}</TextoVacio>}
        {arbol && arbol.total > 0 && (
          <>
            <p className="mb-2 text-sm text-mut">
              {arbol.total} {arbol.total === 1 ? config.singular : config.plural}
            </p>
            <ListaArbol
              nodos={arbol.nodos}
              rutaBase={config.rutaBase}
              rotuloSubDe={textos.subDe}
              ocultoUno={textos.ocultoUno}
              ocultoVarios={textos.ocultoVarios}
              extra={extra}
              acciones={acciones}
            />
          </>
        )}
      </Tarjeta>

      <DialogosJerarquia
        config={config}
        acciones={acciones}
        alMensaje={confirmacion.mostrar}
        todos={lista.data}
        listaConError={lista.isError}
        objetivos={objetivos}
      />
    </div>
  )
}
