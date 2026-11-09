import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { mensajeGuardada, mensajeMadreCambiada, mensajeSubtareaAgregada } from '@/lib/fechas'
import type { Tarea } from '@/types/tarea'
import { candidatasMadre } from './candidatasMadre'
import { SelectorMadre } from './SelectorMadre'
import { useTodasLasTareas } from './useTodasLasTareas'
import {
  MAX_TITULO,
  aRequest,
  puedeAgregarSubtarea,
  puedePosponer,
  validarHoraFin,
  validarHoraInicio,
  valoresIniciales,
  type ValoresTarea,
} from './formularioTarea'
import type { Acciones } from './useAccionesTarea'
import { useGuardarTarea } from './useGuardarTarea'
import { useTareaMadre } from './useTareaMadre'

/** `{}` crea una tarea; `{ tarea }` edita; `{ padre }` crea una subtarea de `padre`. */
export interface EstadoTareaDialog {
  tarea?: Tarea
  padre?: Tarea
}

interface Props {
  /** Cerrado si es `null`. */
  abierto: EstadoTareaDialog | null
  alCerrar: () => void
  /** Se llama tras guardar con el mensaje de confirmación (para el aria-live de la página). */
  alGuardar: (mensaje: string) => void
  acciones: Acciones
}

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

/** Diálogo para crear o editar una tarea (mismo formulario). El formulario se monta de nuevo cada vez que se abre. */
export function TareaDialog({ abierto, alCerrar, alGuardar, acciones }: Props) {
  // Lo escribe el selector de madre: con la lista abierta, Escape cierra solo la lista y no el diálogo.
  // Radix escucha Escape en el documento (fase de captura), antes que cualquier onKeyDown de React.
  const selectorAbierto = useRef(false)
  return (
    <Dialog open={abierto !== null} onOpenChange={(open) => !open && alCerrar()}>
      <DialogContent onEscapeKeyDown={(e) => selectorAbierto.current && e.preventDefault()}>
        {abierto && (
          <Formulario
            tarea={abierto.tarea}
            padre={abierto.padre}
            alCerrar={alCerrar}
            alGuardar={alGuardar}
            acciones={acciones}
            selectorAbierto={selectorAbierto}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Formulario({
  tarea,
  padre,
  alCerrar,
  alGuardar,
  acciones,
  selectorAbierto,
}: {
  tarea?: Tarea
  padre?: Tarea
  alCerrar: () => void
  alGuardar: (mensaje: string) => void
  acciones: Acciones
  selectorAbierto: MutableRefObject<boolean>
}) {
  const guardar = useGuardarTarea()
  // `undefined` = el usuario no tocó el campo "Madre": el PUT conserva el padreId original.
  const [madreElegida, setMadreElegida] = useState<MadreElegida>()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<ValoresTarea>({ defaultValues: valoresIniciales(tarea) })

  const fecha = useWatch({ control, name: 'fecha' })
  const sinFecha = !fecha

  // Sin fecha no hay horas: al vaciarla se limpian.
  useEffect(() => {
    if (!fecha) {
      setValue('horaInicio', '')
      setValue('horaFin', '')
    }
  }, [fecha, setValue])

  const enviar = handleSubmit((valores) => {
    const request = aRequest(valores, tarea, tarea ? madreElegida?.id : padre?.id)
    guardar.mutate(
      { id: tarea?.id, request },
      {
        onSuccess: () => {
          const cambioMadre = tarea !== undefined && request.padreId !== tarea.padreId
          alGuardar(
            padre
              ? mensajeSubtareaAgregada(padre.titulo)
              : cambioMadre
                ? mensajeMadreCambiada(request.titulo, madreElegida?.titulo ?? null)
                : mensajeGuardada(request.fecha),
          )
          alCerrar()
        },
      },
    )
  })

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div>
        <DialogTitle>{tarea ? 'Editar tarea' : padre ? `Nueva subtarea de «${padre.titulo}»` : 'Nueva tarea'}</DialogTitle>
        <DialogDescription>
          {tarea ? 'Cambia lo que necesites y guarda.' : padre ? 'Anota el paso que falta.' : 'Anota lo que tienes que hacer.'}
        </DialogDescription>
      </div>

      <Campo id="tarea-titulo" etiqueta="Título" error={errors.titulo?.message}>
        <input
          id="tarea-titulo"
          type="text"
          className={CAMPO}
          aria-invalid={errors.titulo ? true : undefined}
          aria-describedby={errors.titulo ? 'tarea-titulo-error' : undefined}
          {...register('titulo', {
            validate: (v) => {
              if (!v.trim()) return 'El título es obligatorio'
              if (v.trim().length > MAX_TITULO) return `El título admite como máximo ${MAX_TITULO} caracteres`
              return true
            },
          })}
        />
      </Campo>

      {tarea && (
        <CampoMadre
          tarea={tarea}
          elegida={madreElegida}
          alElegir={setMadreElegida}
          bloqueado={guardar.isPending}
          abiertoRef={selectorAbierto}
        />
      )}

      <Campo id="tarea-descripcion" etiqueta="Descripción">
        <textarea id="tarea-descripcion" rows={3} className={CAMPO} {...register('descripcion')} />
      </Campo>

      <Campo id="tarea-prioridad" etiqueta="Prioridad">
        <select id="tarea-prioridad" className={CAMPO} {...register('prioridad')}>
          <option value="">Ninguna</option>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
        </select>
      </Campo>

      <div>
        <Campo id="tarea-fecha" etiqueta="Fecha">
          <input id="tarea-fecha" type="date" className={CAMPO} aria-describedby="tarea-fecha-ayuda" {...register('fecha')} />
        </Campo>
        <p id="tarea-fecha-ayuda" className="mt-1 text-xs text-mut">
          {sinFecha ? 'Sin fecha: se guarda en el cofre' : 'Las horas son opcionales.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="tarea-hora-inicio" etiqueta="Hora de inicio" error={errors.horaInicio?.message}>
          <input
            id="tarea-hora-inicio"
            type="time"
            className={CAMPO}
            disabled={sinFecha}
            aria-invalid={errors.horaInicio ? true : undefined}
            aria-describedby={errors.horaInicio ? 'tarea-hora-inicio-error' : undefined}
            {...register('horaInicio', { validate: (v, todos) => validarHoraInicio(v, todos.horaFin) ?? true })}
          />
        </Campo>
        <Campo id="tarea-hora-fin" etiqueta="Hora de fin" error={errors.horaFin?.message}>
          <input
            id="tarea-hora-fin"
            type="time"
            className={CAMPO}
            disabled={sinFecha}
            aria-invalid={errors.horaFin ? true : undefined}
            aria-describedby={errors.horaFin ? 'tarea-hora-fin-error' : undefined}
            {...register('horaFin', { validate: (v, todos) => validarHoraFin(todos.horaInicio, v) ?? true })}
          />
        </Campo>
      </div>

      {(guardar.error || acciones.error) && (
        <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
          {guardar.error?.message ?? acciones.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {tarea ? <AccionesDeLaTarea tarea={tarea} acciones={acciones} bloqueado={guardar.isPending} /> : <span />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={alCerrar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending || acciones.pendiente}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>
  )
}

interface MadreElegida {
  id: number | null
  titulo: string | null
}

/**
 * Campo "Madre" del diálogo de edición. Vive aparte para que las consultas (todas las tareas y la madre
 * actual) solo se hagan al editar. Sin la lista (cargando o fallida) queda deshabilitado mostrando la
 * madre actual, y como `elegida` sigue sin definir el PUT conserva el padreId original.
 */
function CampoMadre({
  tarea,
  elegida,
  alElegir,
  bloqueado,
  abiertoRef,
}: {
  tarea: Tarea
  elegida: MadreElegida | undefined
  alElegir: (madre: MadreElegida) => void
  bloqueado: boolean
  abiertoRef: MutableRefObject<boolean>
}) {
  const lista = useTodasLasTareas()
  const tituloMadreActual = useTareaMadre(tarea.padreId)
  const candidatas = useMemo(() => (lista.data ? candidatasMadre(tarea, lista.data) : undefined), [tarea, lista.data])

  const tituloActual = elegida
    ? elegida.titulo
    : tarea.padreId === null
      ? null
      : (lista.data?.find((t) => t.id === tarea.padreId)?.titulo ?? tituloMadreActual ?? `Tarea n.º ${tarea.padreId}`)

  return (
    <SelectorMadre
      tituloActual={tituloActual}
      idActual={elegida ? elegida.id : tarea.padreId}
      candidatas={candidatas}
      deshabilitado={!lista.data || lista.isError || bloqueado}
      nota={
        lista.isError ? 'No se pudo cargar la lista de tareas; la madre se conserva.' : !lista.data ? 'Cargando tareas…' : undefined
      }
      abiertoRef={abiertoRef}
      alElegir={(id, titulo) => alElegir({ id, titulo })}
    />
  )
}

/** Acciones rápidas en el pie del diálogo de edición (actúan sobre la tarea guardada, no sobre lo escrito en el formulario). */
function AccionesDeLaTarea({ tarea, acciones, bloqueado }: { tarea: Tarea; acciones: Acciones; bloqueado: boolean }) {
  const deshabilitado = bloqueado || acciones.pendiente
  const cancelada = tarea.estado === 'CANCELADO'
  const hecha = tarea.estado === 'HECHO'
  return (
    <div className="flex flex-wrap gap-2">
      {cancelada ? (
        <Button type="button" variant="ghost" size="sm" disabled={deshabilitado} onClick={() => acciones.ejecutar('reactivar', tarea)}>
          Reactivar
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={deshabilitado}
          onClick={() => acciones.ejecutar(hecha ? 'reabrir' : 'hecha', tarea)}
        >
          {hecha ? 'Reabrir' : 'Marcar hecha'}
        </Button>
      )}
      {puedeAgregarSubtarea(tarea) && (
        // La elección (crear / vincular) se abre encima, como Posponer y Borrar. Ojo: solo "Crear una nueva"
        // REEMPLAZA la edición por la creación, y entonces lo escrito en el formulario y sin guardar se pierde.
        <Button type="button" variant="ghost" size="sm" disabled={deshabilitado} onClick={() => acciones.pedirSubtarea(tarea)}>
          Agregar subtarea
        </Button>
      )}
      {puedePosponer(tarea) && (
        <Button type="button" variant="ghost" size="sm" disabled={deshabilitado} onClick={() => acciones.pedirPosponer(tarea)}>
          Posponer
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" disabled={deshabilitado} onClick={() => acciones.pedirBorrado(tarea)}>
        Borrar
      </Button>
    </div>
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
