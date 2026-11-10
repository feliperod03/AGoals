import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import { CAMPO } from '@/features/cofre/estilos'
import type { AccionesIdeas } from './useAccionesIdeas'

type Concluir = NonNullable<AccionesIdeas['concluir']>

/** Concluir una idea con una conclusión opcional. Vacía conserva la anterior (si la hay). */
export function ConcluirIdeaDialog({ acciones }: { acciones: AccionesIdeas }) {
  const concluir = acciones.concluir
  return (
    <Dialog open={concluir !== null} onOpenChange={(open) => !open && !concluir?.pendiente && concluir?.cancelar()}>
      <DialogContent>{concluir && <Contenido key={concluir.idea.id} concluir={concluir} />}</DialogContent>
    </Dialog>
  )
}

function Contenido({ concluir }: { concluir: Concluir }) {
  const [texto, setTexto] = useState('')
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        concluir.confirmar(texto)
      }}
    >
      <div>
        <DialogTitle>Concluir idea</DialogTitle>
        <DialogDescription>«{concluir.idea.titulo}»</DialogDescription>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="idea-concluir-texto" className="text-sm font-medium">
          Conclusión (opcional)
        </label>
        <textarea
          id="idea-concluir-texto"
          rows={4}
          className={CAMPO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-describedby="idea-concluir-ayuda"
        />
        <p id="idea-concluir-ayuda" className="text-xs text-mut">
          Si la dejas vacía se conserva la conclusión anterior, si la hay.
        </p>
      </div>

      <ErrorDialogo mensaje={concluir.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={concluir.cancelar} disabled={concluir.pendiente}>
          Cancelar
        </Button>
        <Button type="submit" disabled={concluir.pendiente}>
          {concluir.pendiente ? 'Concluyendo…' : 'Concluir'}
        </Button>
      </div>
    </form>
  )
}
