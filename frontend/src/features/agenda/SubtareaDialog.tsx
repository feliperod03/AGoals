import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { BuscadorTareas } from './BuscadorTareas'
import { candidatasSubtarea } from './candidatasSubtarea'
import { ErrorDialogo } from './ErrorDialogo'
import type { Acciones } from './useAccionesTarea'
import { useTodasLasTareas } from './useTodasLasTareas'

/**
 * "Agregar subtarea a «X»": crear una nueva (flujo de 8.2d) o vincular una existente (PUT con `padreId` = X).
 * Se monta una vez en la página y se abre con `acciones.pedirSubtarea`. Escape cierra todo el diálogo
 * (el buscador es un panel inline, no un popup), salvo mientras hay una mutación en curso.
 */
export function SubtareaDialog({ acciones }: { acciones: Acciones }) {
  const { subtarea } = acciones
  return (
    <Dialog open={subtarea !== null} onOpenChange={(open) => !open && !subtarea?.pendiente && subtarea?.cancelar()}>
      <DialogContent>{subtarea && <Eleccion subtarea={subtarea} />}</DialogContent>
    </Dialog>
  )
}

function Eleccion({ subtarea }: { subtarea: NonNullable<Acciones['subtarea']> }) {
  const { madre, pendiente } = subtarea
  const [vinculando, setVinculando] = useState(false)
  // Solo se consulta con el diálogo abierto; comparte la clave del Cofre y del borrado.
  const lista = useTodasLasTareas()
  const candidatas = useMemo(() => (lista.data ? candidatasSubtarea(madre, lista.data) : undefined), [madre, lista.data])
  const sinLista = !candidatas
  const nota = lista.isError ? 'No se pudo cargar la lista de tareas' : sinLista ? 'Cargando tareas…' : undefined

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Agregar subtarea a «{madre.titulo}»</DialogTitle>
        <DialogDescription>¿Creas una tarea nueva o vinculas una que ya existe?</DialogDescription>
      </div>

      <Button type="button" variant="secondary" disabled={pendiente} onClick={subtarea.crearNueva}>
        Crear una nueva
      </Button>

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          disabled={pendiente || sinLista}
          aria-expanded={vinculando && !sinLista}
          aria-controls="subtarea-vincular-panel"
          onClick={() => setVinculando((v) => !v)}
        >
          Vincular una existente
        </Button>
        {nota && <p className="text-xs text-mut">{nota}</p>}
      </div>

      {vinculando && candidatas && (
        <BuscadorTareas
          idInput="subtarea-buscar"
          idPanel="subtarea-vincular-panel"
          etiqueta="Buscar tarea"
          candidatas={candidatas}
          deshabilitado={pendiente}
          alElegir={subtarea.vincular}
        />
      )}

      <ErrorDialogo mensaje={subtarea.error} />
    </div>
  )
}
