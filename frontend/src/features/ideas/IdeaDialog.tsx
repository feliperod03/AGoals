import { useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import { CAMPO } from '@/features/cofre/estilos'
import { candidatosParaTarea, nombreDe } from '@/features/jerarquia/candidatosVinculo'
import type { ItemJerarquico } from '@/features/jerarquia/tipos'
import type { Idea } from '@/types/idea'
import { aRequestIdea, conclusionEditable, MAX_TITULO, valoresIniciales, type TipoVinculoIdea, type ValoresIdea } from './formulario'
import { SelectorVinculo } from './SelectorVinculo'
import type { AccionesIdeas } from './useAccionesIdeas'

/** Proyectos u objetivos entre los que elegir; `lista` es `undefined` mientras cargan o si fallaron. */
export interface ListaVinculable {
  lista: ItemJerarquico[] | undefined
  error: boolean
}

interface Props {
  acciones: AccionesIdeas
  proyectos: ListaVinculable
  objetivos: ListaVinculable
}

/** Diálogo para crear o editar una idea. Se monta de nuevo cada vez que se abre. */
export function IdeaDialog({ acciones, proyectos, objetivos }: Props) {
  // Lo escribe el selector: con la lista abierta, Escape cierra solo la lista y no el diálogo.
  const selectorAbierto = useRef(false)
  const { dialogo } = acciones
  return (
    <Dialog open={dialogo !== null} onOpenChange={(open) => !open && !acciones.guardando && acciones.cerrarDialogo()}>
      <DialogContent onEscapeKeyDown={(e) => selectorAbierto.current && e.preventDefault()}>
        {dialogo && <Formulario idea={dialogo.idea} acciones={acciones} proyectos={proyectos} objetivos={objetivos} selectorAbierto={selectorAbierto} />}
      </DialogContent>
    </Dialog>
  )
}

interface VinculoElegido {
  tipo: TipoVinculoIdea
  id: number | null
  nombre: string | null
}

const NOMBRE_TIPO = { proyecto: 'proyectos', objetivo: 'objetivos' } as const

function Formulario({
  idea,
  acciones,
  proyectos,
  objetivos,
  selectorAbierto,
}: Props & { idea: Idea | undefined; selectorAbierto: MutableRefObject<boolean> }) {
  const iniciales = valoresIniciales(idea)
  const { register, handleSubmit, formState: { errors } } = useForm<ValoresIdea>({ defaultValues: iniciales })
  // El vínculo vive aparte del formulario: un solo par {tipo, id} hace imposible mandar proyecto y objetivo a la vez.
  const [vinculo, setVinculo] = useState<VinculoElegido>({ tipo: iniciales.tipoVinculo, id: iniciales.vinculoId, nombre: null })
  const [falta, setFalta] = useState<string | null>(null)
  const bloqueado = acciones.guardando
  const conclusionVisible = conclusionEditable(idea)

  const listas = { proyecto: proyectos, objetivo: objetivos }
  const disponible = (tipo: 'proyecto' | 'objetivo') => listas[tipo].lista !== undefined && !listas[tipo].error
  // Con un vínculo vigente cuya lista no está disponible, el campo entero queda quieto: se reenvía el original, nunca a ciegas.
  const vigente = vinculo.tipo === 'ninguno' ? null : vinculo.tipo
  const campoBloqueado = bloqueado || (vigente !== null && !disponible(vigente))

  function nota(tipo: 'proyecto' | 'objetivo'): string | undefined {
    if (disponible(tipo)) return undefined
    const plural = NOMBRE_TIPO[tipo]
    return listas[tipo].error ? `No se pudo cargar la lista de ${plural}.` : `Cargando ${plural}…`
  }

  function cambiarTipo(tipo: TipoVinculoIdea) {
    setFalta(null)
    // Volver al tipo original recupera su id; cualquier otro empieza sin elegir.
    setVinculo({ tipo, id: tipo === iniciales.tipoVinculo ? iniciales.vinculoId : null, nombre: null })
  }

  const enviar = handleSubmit((valores) => {
    if (vinculo.tipo !== 'ninguno' && vinculo.id === null) {
      setFalta(`Elige un ${vinculo.tipo}`)
      return
    }
    acciones.guardar(aRequestIdea({ ...valores, tipoVinculo: vinculo.tipo, vinculoId: vinculo.id }, idea), idea)
  })

  const lista = vigente ? listas[vigente].lista : undefined
  const originalDelTipo = vigente !== null && vigente === iniciales.tipoVinculo ? iniciales.vinculoId : null
  const candidatos = useMemo(() => (lista ? candidatosParaTarea(lista, originalDelTipo) : undefined), [lista, originalDelTipo])
  const nombreVigente = vinculo.id === null ? null : (vinculo.nombre ?? nombreDe(lista, vinculo.id))

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div>
        <DialogTitle>{idea ? 'Editar idea' : 'Nueva idea'}</DialogTitle>
        <DialogDescription>{idea ? 'Cambia lo que necesites y guarda.' : 'Anota la idea antes de que se escape.'}</DialogDescription>
      </div>

      <Campo id="idea-titulo" etiqueta="Título" error={errors.titulo?.message}>
        <input
          id="idea-titulo"
          type="text"
          className={CAMPO}
          aria-invalid={errors.titulo ? true : undefined}
          aria-describedby={errors.titulo ? 'idea-titulo-error' : undefined}
          {...register('titulo', {
            validate: (v) => {
              if (!v.trim()) return 'El título es obligatorio'
              if (v.trim().length > MAX_TITULO) return `El título admite como máximo ${MAX_TITULO} caracteres`
              return true
            },
          })}
        />
      </Campo>

      <Campo id="idea-descripcion" etiqueta="Descripción">
        <textarea id="idea-descripcion" rows={3} className={CAMPO} {...register('descripcion')} />
      </Campo>

      <fieldset className="flex flex-col gap-2" disabled={campoBloqueado}>
        <legend className="mb-1 text-sm font-medium">Ligada a</legend>
        <div className="flex flex-wrap gap-4">
          <Radio valor="ninguno" etiqueta="Ninguno" elegido={vinculo.tipo} alElegir={cambiarTipo} />
          <Radio valor="proyecto" etiqueta="Proyecto" elegido={vinculo.tipo} alElegir={cambiarTipo} deshabilitado={!disponible('proyecto')} />
          <Radio valor="objetivo" etiqueta="Objetivo" elegido={vinculo.tipo} alElegir={cambiarTipo} deshabilitado={!disponible('objetivo')} />
        </div>
        {vigente === null && (nota('proyecto') || nota('objetivo')) && (
          <p className="text-xs text-mut">{[nota('proyecto'), nota('objetivo')].filter(Boolean).join(' ')}</p>
        )}
        {vigente !== null && (
          <SelectorVinculo
            key={vigente}
            tipo={vigente}
            nombreActual={nombreVigente}
            idActual={vinculo.id}
            candidatos={candidatos}
            deshabilitado={campoBloqueado}
            nota={nota(vigente) ? `${nota(vigente)} Se conserva el vínculo actual.` : undefined}
            abiertoRef={selectorAbierto}
            alElegir={(id, nombre) => {
              setFalta(null)
              setVinculo({ tipo: vigente, id, nombre })
            }}
          />
        )}
        {falta && (
          <p role="alert" className="text-xs text-tx">
            {falta}
          </p>
        )}
      </fieldset>

      {conclusionVisible && (
        <Campo id="idea-conclusion" etiqueta="Conclusión">
          <textarea id="idea-conclusion" rows={3} className={CAMPO} {...register('conclusion')} />
        </Campo>
      )}

      <ErrorDialogo mensaje={acciones.errorGuardar} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={acciones.cerrarDialogo} disabled={bloqueado}>
          Cancelar
        </Button>
        <Button type="submit" disabled={bloqueado}>
          {bloqueado ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

function Radio({
  valor,
  etiqueta,
  elegido,
  alElegir,
  deshabilitado = false,
}: {
  valor: TipoVinculoIdea
  etiqueta: string
  elegido: TipoVinculoIdea
  alElegir: (tipo: TipoVinculoIdea) => void
  deshabilitado?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="radio" name="idea-ligada-a" value={valor} checked={elegido === valor} disabled={deshabilitado && elegido !== valor} onChange={() => alElegir(valor)} className="accent-acc" />
      {etiqueta}
    </label>
  )
}

function Campo({ id, etiqueta, error, children }: { id: string; etiqueta: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-tx">
          {error}
        </p>
      )}
    </div>
  )
}
