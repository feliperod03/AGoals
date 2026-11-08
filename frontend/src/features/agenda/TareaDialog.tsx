import { useEffect, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { mensajeGuardada } from '@/lib/fechas'
import type { Tarea } from '@/types/tarea'
import {
  MAX_TITULO,
  aRequest,
  validarHoraFin,
  validarHoraInicio,
  valoresIniciales,
  type ValoresTarea,
} from './formularioTarea'
import type { Acciones } from './useAccionesTarea'
import { useGuardarTarea } from './useGuardarTarea'

interface Props {
  /** Cerrado si es `null`; con `{}` crea y con `{ tarea }` edita. */
  abierto: { tarea?: Tarea } | null
  alCerrar: () => void
  /** Se llama tras guardar con el mensaje de confirmación (para el aria-live de la página). */
  alGuardar: (mensaje: string) => void
  acciones: Acciones
}

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

/** Diálogo para crear o editar una tarea (mismo formulario). El formulario se monta de nuevo cada vez que se abre. */
export function TareaDialog({ abierto, alCerrar, alGuardar, acciones }: Props) {
  return (
    <Dialog open={abierto !== null} onOpenChange={(open) => !open && alCerrar()}>
      <DialogContent>{abierto && <Formulario tarea={abierto.tarea} alCerrar={alCerrar} alGuardar={alGuardar} acciones={acciones} />}</DialogContent>
    </Dialog>
  )
}

function Formulario({
  tarea,
  alCerrar,
  alGuardar,
  acciones,
}: {
  tarea?: Tarea
  alCerrar: () => void
  alGuardar: (mensaje: string) => void
  acciones: Acciones
}) {
  const guardar = useGuardarTarea()
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
    const request = aRequest(valores, tarea)
    guardar.mutate(
      { id: tarea?.id, request },
      {
        onSuccess: () => {
          alGuardar(mensajeGuardada(request.fecha))
          alCerrar()
        },
      },
    )
  })

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div>
        <DialogTitle>{tarea ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        <DialogDescription>{tarea ? 'Cambia lo que necesites y guarda.' : 'Anota lo que tienes que hacer.'}</DialogDescription>
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
      {!cancelada && !hecha && (
        <Button type="button" variant="ghost" size="sm" disabled={deshabilitado} onClick={() => acciones.ejecutar('posponer', tarea)}>
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
