import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { aValorDatetimeLocal, formatearFechaHoraCorta, mensajeEventoEmpieza } from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import type { Recordatorio, RecordatorioRequest } from '@/types/recordatorio'
import type { Tarea } from '@/types/tarea'
import { ErrorDialogo } from './ErrorDialogo'
import {
  armarRequest,
  exigeDescripcion,
  valorInicialEvento,
  valorInicialSuelto,
  valorInicialTarea,
  yaPaso,
  type BaseRecordatorio,
  type ConsultaRecordatorio,
  type DestinoRecordatorio,
} from './recordatorioForm'
import { useAccionesRecordatorio, type AccionesRecordatorio } from './useAccionesRecordatorio'
import { useRecordatorioDeEvento } from './useRecordatorioDeEvento'
import { useRecordatorioDeTarea } from './useRecordatorioDeTarea'

interface Props {
  destino: DestinoRecordatorio
  alCerrar: () => void
  /** Aviso flotante de la página desde donde se abrió. */
  alMensaje: (mensaje: string) => void
  /** Qué hacer con el foco al cerrar (los diálogos son controlados y Radix no sabe a dónde devolverlo). */
  alCerrarFoco?: (evento: Event) => void
}

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-tx focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Recordatorio de una tarea, nuevo recordatorio suelto o edición de uno existente. Se monta solo mientras está
 * abierto (quien lo usa lo renderiza condicionalmente) y no se puede cerrar con una mutación en curso.
 * - `tarea`: «Recordatorio de «X»». Se consulta el recordatorio de la tarea (máximo uno): si lo hay se edita o
 *   se quita; si no, se crea. Cada cambio es una llamada inmediata y el diálogo sigue abierto (no hay «Guardar»
 *   global); puede abrirse encima de la edición de la tarea.
 * - `evento`: igual que `tarea` («Recordatorio de «X»», máximo uno, llamadas inmediatas), con la línea de cuándo empieza.
 * - `suelto` y `existente`: se cierra al guardar o borrar (el borrado pide confirmación).
 */
export function RecordatorioDialog({ destino, alCerrar, alMensaje, alCerrarFoco }: Props) {
  const acciones = useAccionesRecordatorio({ alMensaje })
  return (
    <Dialog open onOpenChange={(open) => !open && !acciones.pendiente && alCerrar()}>
      <DialogContent onCloseAutoFocus={alCerrarFoco}>
        {destino.tipo === 'tarea' ? (
          <ContenidoTarea tarea={destino.tarea} acciones={acciones} alCerrar={alCerrar} />
        ) : destino.tipo === 'evento' ? (
          <ContenidoEvento evento={destino.evento} acciones={acciones} alCerrar={alCerrar} />
        ) : (
          <ContenidoFila destino={destino} acciones={acciones} alCerrar={alCerrar} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Textos que cambian según de quién es el recordatorio. */
const TEXTOS = {
  tarea: { ya: 'Esta tarea ya tiene un recordatorio. Cada cambio se aplica al momento.', fallo: 'No se pudo consultar el recordatorio de esta tarea.' },
  evento: { ya: 'Este evento ya tiene un recordatorio. Cada cambio se aplica al momento.', fallo: 'No se pudo consultar el recordatorio de este evento.' },
} as const

/**
 * `useRecordatorioDeTarea` y `useRecordatorioDeEvento` no se pueden llamar condicionalmente: cada envoltorio llama al
 * suyo y le pasa la consulta a `ContenidoConsultado`, que es el mismo para los dos.
 */
function ContenidoTarea({ tarea, acciones, alCerrar }: { tarea: Tarea; acciones: AccionesRecordatorio; alCerrar: () => void }) {
  const consulta = useRecordatorioDeTarea(tarea.id)
  return (
    <ContenidoConsultado
      consulta={consulta}
      sujeto="tarea"
      titulo={tarea.titulo}
      base={{ tareaId: tarea.id, eventoId: null, canal: 'APP' }}
      valorNuevo={valorInicialTarea(tarea, new Date())}
      acciones={acciones}
      alCerrar={alCerrar}
    />
  )
}

function ContenidoEvento({ evento, acciones, alCerrar }: { evento: Evento; acciones: AccionesRecordatorio; alCerrar: () => void }) {
  const consulta = useRecordatorioDeEvento(evento.id)
  return (
    <ContenidoConsultado
      consulta={consulta}
      sujeto="evento"
      titulo={evento.titulo}
      base={{ tareaId: null, eventoId: evento.id, canal: 'APP' }}
      valorNuevo={valorInicialEvento(evento)}
      nota={mensajeEventoEmpieza(evento.fechaHoraInicio, evento.fechaHoraFin)}
      acciones={acciones}
      alCerrar={alCerrar}
    />
  )
}

interface ConsultadoProps {
  consulta: ConsultaRecordatorio
  sujeto: keyof typeof TEXTOS
  titulo: string
  /** Ids y canal del recordatorio cuando todavía no existe. */
  base: BaseRecordatorio
  /** Valor de `datetime-local` con el que arranca uno nuevo. */
  valorNuevo: string
  /** Línea informativa bajo la descripción (por ejemplo, cuándo empieza el evento). */
  nota?: string
  acciones: AccionesRecordatorio
  alCerrar: () => void
}

function ContenidoConsultado({ consulta, sujeto, titulo, base, valorNuevo, nota, acciones, alCerrar }: ConsultadoProps) {
  const { recordatorio, cargando, fallo, reintentar } = consulta
  // Sin la consulta no se sabe si hay uno: nunca se escribe a ciegas.
  const bloqueado = cargando || fallo
  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>Recordatorio de «{titulo}»</DialogTitle>
        <DialogDescription>{recordatorio ? TEXTOS[sujeto].ya : 'Cada cambio se aplica al momento.'}</DialogDescription>
        {nota && <p className="mt-1 text-sm text-mut">{nota}</p>}
      </div>

      {cargando && <p className="text-sm text-mut">Cargando el recordatorio…</p>}
      {fallo && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
            {TEXTOS[sujeto].fallo}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={reintentar}>
            Reintentar
          </Button>
        </div>
      )}

      <Formulario
        // Al crearse, quitarse o desaparecer el recordatorio, el formulario arranca de cero con los valores que corresponden.
        key={recordatorio?.id ?? 'nuevo'}
        base={recordatorio ?? base}
        valorInicial={recordatorio ? aValorDatetimeLocal(recordatorio.fechaHora) : valorNuevo}
        descripcionInicial={recordatorio?.descripcion ?? ''}
        bloqueado={bloqueado}
        etiquetaGuardar={recordatorio ? 'Guardar cambios' : 'Crear recordatorio'}
        acciones={acciones}
        alGuardar={(req) => (recordatorio ? acciones.actualizar(recordatorio.id, req) : acciones.crear(req))}
        quitar={
          recordatorio
            ? { etiqueta: `Quitar el recordatorio de «${titulo}»`, alQuitar: () => acciones.borrar(recordatorio.id) }
            : undefined
        }
      />

      <div role="status" className="min-h-5 text-sm text-mut">
        {acciones.resultado}
      </div>
      <ErrorDialogo mensaje={acciones.error} />

      <div className="flex justify-end">
        <Button type="button" variant="secondary" disabled={acciones.pendiente} onClick={alCerrar}>
          Listo
        </Button>
      </div>
    </div>
  )
}

function ContenidoFila({
  destino,
  acciones,
  alCerrar,
}: {
  destino: Exclude<DestinoRecordatorio, { tipo: 'tarea' | 'evento' }>
  acciones: AccionesRecordatorio
  alCerrar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const existente: Recordatorio | null = destino.tipo === 'existente' ? destino.recordatorio : null

  if (existente && confirmando) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <DialogTitle>¿Borrar este recordatorio?</DialogTitle>
          <DialogDescription>
            {existente.descripcion?.trim() ? `«${existente.descripcion}» · ` : ''}
            {formatearFechaHoraCorta(existente.fechaHora)}
          </DialogDescription>
        </div>
        <div role="status" className="sr-only">
          {acciones.resultado}
        </div>
        <ErrorDialogo mensaje={acciones.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={acciones.pendiente} onClick={() => setConfirmando(false)}>
            Conservar
          </Button>
          <Button type="button" disabled={acciones.pendiente} onClick={() => acciones.borrar(existente.id, alCerrar)}>
            {acciones.pendiente ? 'Borrando…' : 'Borrar recordatorio'}
          </Button>
        </div>
      </div>
    )
  }

  const base: BaseRecordatorio = existente ?? { tareaId: null, eventoId: null, canal: 'APP' }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <DialogTitle>{existente ? 'Editar recordatorio' : 'Nuevo recordatorio'}</DialogTitle>
        <DialogDescription>
          {exigeDescripcion(base) ? 'No está ligado a una tarea: la descripción es obligatoria.' : 'Cambia la fecha, la hora o la descripción.'}
        </DialogDescription>
      </div>

      <Formulario
        base={base}
        valorInicial={existente ? aValorDatetimeLocal(existente.fechaHora) : valorInicialSuelto(new Date())}
        descripcionInicial={existente?.descripcion ?? ''}
        bloqueado={false}
        etiquetaGuardar={existente ? 'Guardar cambios' : 'Crear recordatorio'}
        acciones={acciones}
        alGuardar={(req) => (existente ? acciones.actualizar(existente.id, req, alCerrar) : acciones.crear(req, alCerrar))}
        quitar={existente ? { etiqueta: 'Borrar este recordatorio', alQuitar: () => setConfirmando(true), texto: 'Borrar' } : undefined}
      />

      <div role="status" className="sr-only">
        {acciones.resultado}
      </div>
      <ErrorDialogo mensaje={acciones.error} />

      <div className="flex justify-end">
        <Button type="button" variant="ghost" disabled={acciones.pendiente} onClick={alCerrar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

interface FormularioProps {
  base: BaseRecordatorio
  valorInicial: string
  descripcionInicial: string
  bloqueado: boolean
  etiquetaGuardar: string
  acciones: AccionesRecordatorio
  alGuardar: (req: RecordatorioRequest) => void
  quitar?: { etiqueta: string; alQuitar: () => void; texto?: string }
}

function Formulario({ base, valorInicial, descripcionInicial, bloqueado, etiquetaGuardar, acciones, alGuardar, quitar }: FormularioProps) {
  const id = useId()
  const [valor, setValor] = useState(valorInicial)
  const [descripcion, setDescripcion] = useState(descripcionInicial)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)
  const obligatoria = exigeDescripcion(base)
  const deshabilitado = bloqueado || acciones.pendiente

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (deshabilitado) return
        const resultado = armarRequest(base, valor, descripcion)
        if (!resultado.ok) return setErrorLocal(resultado.error)
        setErrorLocal(null)
        alGuardar(resultado.request)
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-fecha`} className="text-sm font-medium">
          Fecha y hora
        </label>
        <input
          id={`${id}-fecha`}
          type="datetime-local"
          className={CAMPO}
          value={valor}
          disabled={deshabilitado}
          onChange={(e) => setValor(e.target.value)}
          aria-describedby={yaPaso(valor, new Date()) ? `${id}-paso` : undefined}
        />
        {yaPaso(valor, new Date()) && (
          <p id={`${id}-paso`} className="text-xs text-mut">
            Esa hora ya pasó: el aviso saldrá enseguida.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-descripcion`} className="text-sm font-medium">
          {obligatoria ? 'Descripción (obligatoria)' : 'Descripción (opcional)'}
        </label>
        <input
          id={`${id}-descripcion`}
          type="text"
          className={CAMPO}
          value={descripcion}
          disabled={deshabilitado}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <ErrorDialogo mensaje={errorLocal} />

      <div className="flex flex-wrap justify-end gap-2">
        {quitar && (
          <Button type="button" variant="ghost" aria-label={quitar.etiqueta} disabled={deshabilitado} onClick={quitar.alQuitar}>
            {quitar.texto ?? 'Quitar recordatorio'}
          </Button>
        )}
        <Button type="submit" disabled={deshabilitado}>
          {acciones.pendiente ? 'Guardando…' : etiquetaGuardar}
        </Button>
      </div>
    </form>
  )
}
