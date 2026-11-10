import { BorrarIdeaDialog } from './BorrarIdeaDialog'
import { ConcluirIdeaDialog } from './ConcluirIdeaDialog'
import { IdeaDialog, type ListaVinculable } from './IdeaDialog'
import type { AccionesIdeas } from './useAccionesIdeas'

/** Crear/editar, concluir y borrar; se montan una sola vez en la página. */
export function DialogosIdeas({ acciones, proyectos, objetivos }: { acciones: AccionesIdeas; proyectos: ListaVinculable; objetivos: ListaVinculable }) {
  return (
    <>
      <IdeaDialog acciones={acciones} proyectos={proyectos} objetivos={objetivos} />
      <ConcluirIdeaDialog acciones={acciones} />
      <BorrarIdeaDialog acciones={acciones} />
    </>
  )
}
