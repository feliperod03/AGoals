import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import type { CategoriaBorrado, Eleccion, Elecciones } from '@/types/impactoBorrado'
import { avisoRescatados, categoriasVisibles, eleccionDe, parametrosDe, partesBorradas, resumenBorrado, textoFila } from './borrado'
import type { ConfigJerarquia } from './config'
import { FilaBorrado } from './FilaBorrado'
import type { ItemJerarquico } from './tipos'
import type { AccionesJerarquia } from './useAccionesJerarquia'
import { useImpactoBorrado } from './useImpactoBorrado'

/**
 * Confirmación de borrado de un proyecto u objetivo. Muestra una fila por categoría con elementos (subelementos,
 * proyectos, tareas, ideas) para elegir «Mover» o «Borrar», y un resumen en vivo de lo que desaparece según la
 * vista previa del backend. Sin elementos dependientes queda el diálogo simple, con DELETE sin parámetros.
 */
export function BorrarItemDialog<T extends ItemJerarquico, R>({ config, acciones }: { config: ConfigJerarquia<T, R>; acciones: AccionesJerarquia<T> }) {
  const { borrado } = acciones
  return (
    <Dialog open={borrado !== null} onOpenChange={(open) => !open && !borrado?.pendiente && borrado?.cancelar()}>
      <DialogContent>
        {/* `key`: el estado de las elecciones se reinicia al abrir el diálogo para otro elemento. */}
        {borrado && <ContenidoBorrado key={borrado.item.id} config={config} borrado={borrado} />}
      </DialogContent>
    </Dialog>
  )
}

function ContenidoBorrado<T extends ItemJerarquico, R>({
  config,
  borrado,
}: {
  config: ConfigJerarquia<T, R>
  borrado: NonNullable<AccionesJerarquia<T>['borrado']>
}) {
  const { item } = borrado
  // Se guarda la elección de toda categoría tocada, también si su fila desaparece: si reaparece, conserva el valor.
  const [elecciones, setElecciones] = useState<Elecciones>({})
  const impacto = useImpactoBorrado(config, item.id, elecciones)

  const datos = impacto.data
  const visibles = datos ? categoriasVisibles(datos, config.categoriasBorrado) : []
  // Con datos de la elección anterior (`isPlaceholderData`) se muestra lo viejo pero no se deja confirmar.
  const actualizada = impacto.isSuccess && !impacto.isPlaceholderData && !impacto.isFetching
  const rescatados = datos ? avisoRescatados(datos, elecciones) : null

  function confirmar() {
    if (!datos) return
    if (visibles.length === 0) borrado.confirmar()
    else borrado.confirmar({ elecciones: parametrosDe(elecciones, visibles), tambien: partesBorradas(datos, config.categoriasBorrado) })
  }

  function elegir(clave: CategoriaBorrado, eleccion: Eleccion) {
    setElecciones((actuales) => ({ ...actuales, [clave]: eleccion }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Borrar {config.singular}</DialogTitle>
        <DialogDescription>¿Borrar «{item.nombre}»? No se puede deshacer.</DialogDescription>
      </div>

      {impacto.isError && (
        <div className="flex flex-col items-start gap-2">
          <ErrorDialogo mensaje="No se pudo calcular qué se borra" />
          <Button type="button" variant="secondary" size="sm" onClick={() => void impacto.refetch()} disabled={impacto.isFetching || borrado.pendiente}>
            Reintentar
          </Button>
        </div>
      )}

      {datos === undefined && !impacto.isError && <p className="text-sm text-mut">Calculando qué se borra…</p>}

      {visibles.length > 0 && datos && (
        <>
          <div className="flex flex-col gap-2">
            {visibles.map((categoria) => (
              <FilaBorrado
                key={categoria.clave}
                titulo={`${categoria.etiqueta} (${datos[categoria.clave]?.total ?? 0})`}
                eleccion={eleccionDe(elecciones, categoria.clave)}
                alElegir={(eleccion) => elegir(categoria.clave, eleccion)}
                ayuda={textoFila(categoria, datos, eleccionDe(elecciones, categoria.clave))}
                deshabilitada={borrado.pendiente}
              />
            ))}
          </div>
          {/* Región viva propia: Radix deja el resto de la página con aria-hidden mientras el diálogo está abierto. */}
          <div role="status" aria-live="polite" className="flex flex-col gap-1 text-sm text-tx">
            <p>{resumenBorrado(item.nombre, datos, config.categoriasBorrado)}</p>
            {rescatados && <p className="text-mut">{rescatados}</p>}
          </div>
        </>
      )}

      <ErrorDialogo mensaje={borrado.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={borrado.cancelar} disabled={borrado.pendiente}>
          Cancelar
        </Button>
        <Button type="button" variant="destructive" onClick={confirmar} disabled={borrado.pendiente || !actualizada}>
          {borrado.pendiente ? 'Borrando…' : 'Borrar'}
        </Button>
      </div>
    </div>
  )
}
