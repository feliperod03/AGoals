import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { getObjetivos } from '@/api/objetivos'
import { getProyectos } from '@/api/proyectos'

import { BuscadorLista } from '@/components/BuscadorLista'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import { useTodasLasTareas } from '@/features/agenda/useTodasLasTareas'
import type { Tarea } from '@/types/tarea'
import { CAMPO_DE, candidatosParaTarea, nombreDe, type TipoVinculo } from './candidatosVinculo'
import type { ItemJerarquico } from './tipos'
import { useVincularTarea } from './useVincularTarea'

interface Props {
  /** La tarea tal como estaba al abrir; el vínculo vigente se lee de la lista de tareas (ver `Contenido`). */
  tarea: Tarea
  alCerrar: () => void
  /** Aviso flotante de la página desde donde se abrió. */
  alMensaje: (mensaje: string) => void
}

/**
 * «Proyecto y objetivo de «X»»: dos campos independientes, cada uno con su vínculo actual, «Cambiar» y «Quitar».
 * No hay botón Guardar: cada cambio es una llamada inmediata (PUT/DELETE del proyecto u objetivo). Se monta solo
 * mientras está abierto (quien lo usa lo renderiza condicionalmente) y no se puede cerrar con una mutación en curso.
 * Pensado para abrirse también encima del diálogo de edición.
 */
export function VincularTareaDialog({ tarea, alCerrar, alMensaje }: Props) {
  const vinculo = useVincularTarea({ alMensaje })
  return (
    <Dialog open onOpenChange={(open) => !open && !vinculo.pendiente && alCerrar()}>
      <DialogContent>
        <Contenido tarea={tarea} vinculo={vinculo} alCerrar={alCerrar} />
      </DialogContent>
    </Dialog>
  )
}

function Contenido({ tarea, vinculo, alCerrar }: { tarea: Tarea; vinculo: ReturnType<typeof useVincularTarea>; alCerrar: () => void }) {
  // Solo se consulta con el diálogo abierto; mismas claves que el Cofre, el listado y el detalle (comparten caché).
  const todas = useTodasLasTareas()
  // Las mismas claves y funciones que `useListaJerarquia`; se piden directo para no arrastrar `config.ts` (y todos los
  // endpoints de proyectos/objetivos) a Hoy y al Cofre.
  const proyectos = useQuery({ queryKey: ['proyectos'], queryFn: getProyectos })
  const objetivos = useQuery({ queryKey: ['objetivos'], queryFn: getObjetivos })
  // Un solo buscador abierto a la vez.
  const [abierto, setAbierto] = useState<TipoVinculo | null>(null)
  // Tras cada cambio se refresca `['tareas','todas']` y el campo muestra el vínculo nuevo. Si esa lista no está
  // (cargando o fallida), vale la foto de la tarea; si estuviera vieja, el 400 de «Quitar» lo corrige.
  const vigente = todas.data?.find((t) => t.id === tarea.id) ?? tarea

  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Proyecto y objetivo de «{tarea.titulo}»</DialogTitle>
        <DialogDescription>Cada cambio se aplica al momento.</DialogDescription>
      </div>

      {(['proyecto', 'objetivo'] as const).map((tipo) => {
        const consulta = tipo === 'proyecto' ? proyectos : objetivos
        return (
          <Campo
            key={tipo}
            tipo={tipo}
            tarea={vigente}
            lista={consulta.data}
            cargando={consulta.isPending}
            fallo={consulta.isError}
            vinculo={vinculo}
            abierto={abierto === tipo}
            alAbrir={() => setAbierto((a) => (a === tipo ? null : tipo))}
            alCerrarBuscador={() => setAbierto(null)}
          />
        )
      })}

      <ErrorDialogo mensaje={vinculo.error} />

      <div className="flex justify-end">
        <Button type="button" variant="secondary" disabled={vinculo.pendiente} onClick={alCerrar}>
          Listo
        </Button>
      </div>
    </div>
  )
}

interface CampoProps {
  tipo: TipoVinculo
  /** La tarea con su vínculo vigente. */
  tarea: Tarea
  lista: ItemJerarquico[] | undefined
  cargando: boolean
  fallo: boolean
  vinculo: ReturnType<typeof useVincularTarea>
  abierto: boolean
  alAbrir: () => void
  alCerrarBuscador: () => void
}

function Campo({ tipo, tarea, lista, cargando, fallo, vinculo, abierto, alAbrir, alCerrarBuscador }: CampoProps) {
  const etiqueta = tipo === 'proyecto' ? 'Proyecto' : 'Objetivo'
  const plural = tipo === 'proyecto' ? 'proyectos' : 'objetivos'
  const idActual = tarea[CAMPO_DE[tipo]]
  // Sin la lista no se puede nombrar lo actual ni ofrecer candidatos: el campo entero queda deshabilitado
  // (ni «Cambiar» ni «Quitar»), así nunca hay un PUT o DELETE a ciegas.
  const disponible = lista !== undefined && !fallo
  const bloqueado = !disponible || vinculo.pendiente
  const actual: { id: number; nombre: string } | null = idActual === null ? null : { id: idActual, nombre: nombreDe(lista, idActual) }
  const candidatos = useMemo(() => (lista ? candidatosParaTarea(lista, idActual) : []), [lista, idActual])
  const nota = fallo ? `No se pudo cargar la lista de ${plural}` : cargando ? `Cargando ${plural}…` : undefined
  const titulo = `campo-vinculo-${tipo}`

  return (
    <section aria-labelledby={titulo} className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 id={titulo} className="text-sm font-medium">
            {etiqueta}
          </h3>
          <p className="text-sm text-mut">{actual ? actual.nombre : `Sin ${tipo}`}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={bloqueado}
            aria-label={`Cambiar ${tipo}`}
            aria-expanded={abierto && disponible}
            aria-controls={`vincular-panel-${tipo}`}
            onClick={alAbrir}
          >
            Cambiar
          </Button>
          {actual && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={bloqueado}
              aria-label={`Quitar ${tipo}`}
              onClick={() => vinculo.quitar({ tipo, tarea, destino: actual, alExito: alCerrarBuscador })}
            >
              Quitar
            </Button>
          )}
        </div>
      </div>
      {nota && <p className="text-xs text-mut">{nota}</p>}

      {abierto && disponible && (
        <>
          <BuscadorLista
            idInput={`vincular-buscar-${tipo}`}
            idPanel={`vincular-panel-${tipo}`}
            etiqueta={`Buscar ${tipo}`}
            textoVacio={`Ningún ${tipo} coincide.`}
            candidatas={candidatos}
            idActual={idActual}
            deshabilitado={vinculo.pendiente}
            alElegir={(item) => {
              // Elegir el que ya tiene no cambia nada: solo se cierra el buscador, sin llamada.
              if (item.id === idActual) return alCerrarBuscador()
              vinculo.asignar({ tipo, tarea, destino: { id: item.id, nombre: item.nombre }, alExito: alCerrarBuscador })
            }}
          />
          {actual && (
            <p className="text-xs text-mut">
              Ahora es del {tipo} «{actual.nombre}»; al elegir otro se moverá.
            </p>
          )}
        </>
      )}
    </section>
  )
}
