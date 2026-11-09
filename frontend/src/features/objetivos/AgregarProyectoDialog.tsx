import { useMemo, useState } from 'react'

import { BuscadorLista } from '@/components/BuscadorLista'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import { candidatosProyectoParaObjetivo } from '@/features/jerarquia/candidatosObjetivo'
import type { ItemJerarquico } from '@/features/jerarquia/tipos'
import { useCambiarObjetivo } from '@/features/jerarquia/useCambiarObjetivo'
import type { Objetivo } from '@/types/objetivo'
import type { Proyecto } from '@/types/proyecto'

interface Props {
  objetivo: Objetivo
  abierto: boolean
  alCerrar: () => void
  /** Se eligió «Crear uno nuevo»: la página cierra este diálogo y abre el de creación con el objetivo prefijado. */
  alCrearNuevo: () => void
  /** La lista completa de proyectos; `undefined` mientras carga o si falló. */
  proyectos: Proyecto[] | undefined
  proyectosConError: boolean
  /** Para nombrar el objetivo actual de cada candidato. */
  objetivos: ItemJerarquico[] | undefined
  alMensaje: (mensaje: string) => void
}

/**
 * «Agregar proyecto a «O»»: crear uno nuevo o vincular uno existente (PUT del proyecto con `objetivoId` = O).
 * Mismo esquema que `SubtareaDialog` (8.2g): "Vincular" se deshabilita sin lista, "Crear" siempre está
 * disponible, el error del servidor se ve en el diálogo y este sigue abierto. Se monta una vez en la página.
 */
export function AgregarProyectoDialog({ abierto, alCerrar, ...resto }: Props) {
  const vinculo = useCambiarObjetivo({ alMensaje: resto.alMensaje })
  const cerrar = () => {
    vinculo.limpiarError()
    alCerrar()
  }
  return (
    // Con una mutación en curso no se puede cerrar.
    <Dialog open={abierto} onOpenChange={(open) => !open && !vinculo.pendiente && cerrar()}>
      <DialogContent>
        {abierto && <Eleccion {...resto} pendiente={vinculo.pendiente} error={vinculo.error} cerrar={cerrar} vincular={vinculo.cambiar} />}
      </DialogContent>
    </Dialog>
  )
}

function Eleccion({
  objetivo,
  proyectos,
  proyectosConError,
  objetivos,
  alCrearNuevo,
  pendiente,
  error,
  cerrar,
  vincular,
}: Omit<Props, 'abierto' | 'alCerrar' | 'alMensaje'> & {
  pendiente: boolean
  error: string | null
  cerrar: () => void
  vincular: ReturnType<typeof useCambiarObjetivo>['cambiar']
}) {
  const [vinculando, setVinculando] = useState(false)
  const candidatas = useMemo(
    () => (proyectos ? candidatosProyectoParaObjetivo(objetivo.id, proyectos, objetivos) : undefined),
    [objetivo.id, proyectos, objetivos],
  )
  const sinLista = !candidatas
  const sinCandidatos = candidatas?.length === 0
  const nota = proyectosConError
    ? 'No se pudo cargar la lista de proyectos'
    : sinLista
      ? 'Cargando proyectos…'
      : sinCandidatos
        ? 'No hay otros proyectos abiertos.'
        : undefined

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Agregar proyecto a «{objetivo.nombre}»</DialogTitle>
        <DialogDescription>¿Creas un proyecto nuevo o vinculas uno que ya existe?</DialogDescription>
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={pendiente}
        onClick={() => {
          cerrar()
          alCrearNuevo()
        }}
      >
        Crear uno nuevo
      </Button>

      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          disabled={pendiente || sinLista || sinCandidatos}
          aria-expanded={vinculando && !sinLista}
          aria-controls="objetivo-vincular-panel"
          onClick={() => setVinculando((v) => !v)}
        >
          Vincular uno existente
        </Button>
        {nota && <p className="text-xs text-mut">{nota}</p>}
      </div>

      {vinculando && candidatas && !sinCandidatos && (
        <BuscadorLista
          idInput="objetivo-buscar-proyecto"
          idPanel="objetivo-vincular-panel"
          etiqueta="Buscar proyecto"
          textoVacio="Ningún proyecto coincide."
          candidatas={candidatas}
          deshabilitado={pendiente}
          alElegir={(proyecto) =>
            vincular({
              proyecto,
              destino: { id: objetivo.id, nombre: objetivo.nombre },
              alExito: cerrar,
            })
          }
        />
      )}

      <ErrorDialogo mensaje={error} />
    </div>
  )
}
