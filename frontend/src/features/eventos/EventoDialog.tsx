import { parseISO } from 'date-fns'
import { useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ErrorDialogo } from '@/features/agenda/ErrorDialogo'
import { yaPaso, type ConsultaRecordatorio } from '@/features/agenda/recordatorioForm'
import { useRecordatorioDeEvento } from '@/features/agenda/useRecordatorioDeEvento'
import { CAMPO } from '@/features/cofre/estilos'
import {
  aValorDatetimeLocal,
  deFechaYHoraLocal,
  esFechaValida,
  formatearFechaHoraCorta,
  notaRecordatorioEventoNoConsultado,
} from '@/lib/fechas'
import type { Evento } from '@/types/evento'
import {
  aRequestEvento,
  alternarTodoElDia,
  esDeVariosDias,
  inicioIso,
  moverFinConservandoDuracion,
  validarTitulo,
  valoresIniciales,
  type ErroresEvento,
  type ValoresEvento,
} from './formularioEvento'
import { instanteMovido } from './moverRecordatorio'
import type { AccionesEvento } from './useAccionesEvento'

interface Props {
  acciones: AccionesEvento
  /** Lo pasa la página: a dónde va el foco al cerrar si el elemento que abrió el diálogo ya no existe. */
  alCerrarFoco: (evento: Event) => void
}

/**
 * Diálogo para crear o editar un evento (9c). El formulario se monta de nuevo cada vez que se abre; mientras guarda no
 * se puede cerrar (Escape, clic fuera, «×»). «Borrar evento» abre la confirmación ENCIMA: si se cancela, lo escrito
 * sigue intacto porque este formulario no se desmonta.
 */
export function EventoDialog({ acciones, alCerrarFoco }: Props) {
  const { dialogo } = acciones
  return (
    <Dialog open={dialogo !== null} onOpenChange={(open) => !open && !acciones.guardando && !acciones.borrando && acciones.cerrarDialogo()}>
      <DialogContent onCloseAutoFocus={alCerrarFoco}>
        {dialogo && (
          <Entrada
            key={dialogo.evento ? `editar-${dialogo.evento.id}` : 'crear'}
            evento={dialogo.evento}
            iniciales={dialogo.evento ? valoresIniciales(dialogo.evento) : dialogo.iniciales}
            acciones={acciones}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Inicio válido según el modo (con «Todo el día» basta el día). */
function inicioValido(v: Pick<ValoresEvento, 'todoElDia' | 'fechaInicio' | 'horaInicio'>): boolean {
  return v.todoElDia ? esFechaValida(v.fechaInicio) : deFechaYHoraLocal(v.fechaInicio, v.horaInicio) !== null
}

interface FormularioProps {
  evento: Evento | undefined
  iniciales: ValoresEvento
  acciones: AccionesEvento
}

/**
 * Al editar se consulta el recordatorio del evento (9d) para rotular el botón «Recordatorio…». El hook no puede
 * llamarse condicionalmente, así que la edición pasa por un envoltorio y la creación no hace ninguna consulta.
 */
function Entrada(props: FormularioProps) {
  return props.evento ? <Edicion {...props} evento={props.evento} /> : <Formulario {...props} consulta={null} />
}

function Edicion(props: FormularioProps & { evento: Evento }) {
  const consulta = useRecordatorioDeEvento(props.evento.id)
  return <Formulario {...props} consulta={consulta} />
}

/** «Recordatorio…» o, si ya hay uno, «Recordatorio: <fecha y hora corta>». Mientras la consulta carga o falla, la primera. */
const etiquetaRecordatorio = (consulta: ConsultaRecordatorio | null) =>
  consulta?.recordatorio ? `Recordatorio: ${formatearFechaHoraCorta(consulta.recordatorio.fechaHora)}` : 'Recordatorio…'

function Formulario({ evento, iniciales, acciones, consulta }: FormularioProps & { consulta: ConsultaRecordatorio | null }) {
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ValoresEvento>({ defaultValues: iniciales })
  const [todoElDia, fechaInicio, horaInicio] = useWatch({ control, name: ['todoElDia', 'fechaInicio', 'horaInicio'] })

  // Mover el recordatorio con el inicio (9e). Todo se deriva en el render: lo que muestra la casilla sale de la misma
  // función y los mismos datos que lo que se manda al guardar. Solo el estado de la casilla es propio (D2: si se
  // desmarca, se respeta aunque la casilla se oculte y vuelva a aparecer).
  const [mover, setMover] = useState(true)
  const inicioFormulario = inicioIso({ todoElDia, fechaInicio, horaInicio })
  const cambioInicio =
    evento !== undefined && inicioFormulario !== null && parseISO(inicioFormulario).getTime() !== parseISO(evento.fechaHoraInicio).getTime()
  // Una consulta fallida pero con datos viejos NO cuenta: nunca se escribe a ciegas.
  const pendiente = consulta && !consulta.fallo && consulta.recordatorio && !consulta.recordatorio.enviado ? consulta.recordatorio : null
  const aMover = evento && pendiente && inicioFormulario ? instanteMovido(pendiente, evento.fechaHoraInicio, inicioFormulario) : null
  // Si cambió el inicio y aún no se sabe si hay recordatorio, `Guardar` espera (si no cambió, nunca espera).
  const esperando = cambioInicio && consulta?.cargando === true
  const seguiraVencido = aMover !== null && yaPaso(aValorDatetimeLocal(aMover), new Date())

  // Errores de fecha y hora (dependen de varios campos): se calculan al enviar y se limpian al tocar una fecha u hora.
  const [erroresFecha, setErroresFecha] = useState<Pick<ErroresEvento, 'inicio' | 'fin'>>({})
  const bloqueado = acciones.guardando || acciones.borrando

  // Último inicio válido: al cambiarlo, el fin se corre conservando la duración (estado, no ref: se lee en el render).
  const [inicioAnterior, setInicioAnterior] = useState({ fechaInicio: iniciales.fechaInicio, horaInicio: iniciales.horaInicio })

  function alCambiarInicio() {
    setErroresFecha({})
    const nuevo = getValues()
    if (!inicioValido(nuevo)) return
    const fin = moverFinConservandoDuracion({ ...nuevo, ...inicioAnterior }, nuevo)
    if (fin) {
      setValue('fechaFin', fin.fechaFin)
      if (!nuevo.todoElDia) setValue('horaFin', fin.horaFin)
    }
    setInicioAnterior({ fechaInicio: nuevo.fechaInicio, horaInicio: nuevo.horaInicio })
  }

  function alAlternarTodoElDia(activar: boolean) {
    setErroresFecha({})
    // `reset` con los valores nuevos: cambia varios campos a la vez sin perder lo escrito en los demás (no toca el inicio).
    reset(alternarTodoElDia({ ...getValues(), todoElDia: !activar }, activar), { keepDefaultValues: true })
  }

  // Con el título inválido, react-hook-form no llama al primer callback: el segundo también calcula los errores de
  // fecha, así el título y las fechas se ven a la vez.
  const enviar = handleSubmit(
    (valores) => {
      const resultado = aRequestEvento(valores)
      if (!resultado.ok) {
        setErroresFecha({ inicio: resultado.errores.inicio, fin: resultado.errores.fin })
        return
      }
      if (esperando) return
      // Se recalcula con el inicio del cuerpo que se manda; el hook lo vuelve a validar con `instanteMovido`.
      const mueve = evento && pendiente && mover && instanteMovido(pendiente, evento.fechaHoraInicio, resultado.request.fechaHoraInicio)
      acciones.guardar(resultado.request, mueve ? pendiente : undefined)
    },
    () => {
      const resultado = aRequestEvento(getValues())
      if (!resultado.ok) setErroresFecha({ inicio: resultado.errores.inicio, fin: resultado.errores.fin })
    },
  )

  const variosDias = evento !== undefined && esDeVariosDias(evento)

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div>
        <DialogTitle>{evento ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
        <DialogDescription>{evento ? 'Cambia lo que necesites y guarda.' : 'Anota la cita o el compromiso.'}</DialogDescription>
        {variosDias && <p className="mt-1 text-sm text-mut">Dura varios días: los cambios valen para todo el evento.</p>}
      </div>

      <Campo id="evento-titulo" etiqueta="Título" error={errors.titulo?.message}>
        <input
          id="evento-titulo"
          type="text"
          className={CAMPO}
          aria-invalid={errors.titulo ? true : undefined}
          aria-describedby={errors.titulo ? 'evento-titulo-error' : undefined}
          {...register('titulo', { validate: (v) => validarTitulo(v) ?? true })}
        />
      </Campo>

      <Campo id="evento-descripcion" etiqueta="Descripción">
        <textarea id="evento-descripcion" rows={2} className={CAMPO} {...register('descripcion')} />
      </Campo>

      <Campo id="evento-prioridad" etiqueta="Prioridad">
        <select id="evento-prioridad" className={CAMPO} {...register('prioridad')}>
          <option value="">Ninguna</option>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
        </select>
      </Campo>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-acc"
          checked={todoElDia}
          onChange={(e) => alAlternarTodoElDia(e.target.checked)}
        />
        Todo el día
      </label>

      <Lapso
        id="evento-inicio"
        error={erroresFecha.inicio}
        etiquetaDia={todoElDia ? 'Primer día' : 'Día de inicio'}
        etiquetaHora="Hora de inicio"
        conHora={!todoElDia}
        dia={register('fechaInicio', { onChange: alCambiarInicio })}
        hora={register('horaInicio', { onChange: alCambiarInicio })}
      />
      <Lapso
        id="evento-fin"
        error={erroresFecha.fin}
        etiquetaDia={todoElDia ? 'Último día' : 'Día de fin'}
        etiquetaHora="Hora de fin"
        conHora={!todoElDia}
        dia={register('fechaFin', { onChange: () => setErroresFecha({}) })}
        hora={register('horaFin', { onChange: () => setErroresFecha({}) })}
      />

      {pendiente && aMover && (
        <div className="flex flex-col gap-1 rounded-xl border border-input px-3 py-2">
          <label className="flex min-h-11 items-start gap-2 py-1 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-acc"
              checked={mover}
              disabled={bloqueado}
              onChange={(e) => setMover(e.target.checked)}
              aria-describedby="evento-recordatorio-ayuda"
            />
            <span>Mover también el recordatorio (cae el {formatearFechaHoraCorta(pendiente.fechaHora)})</span>
          </label>
          <div id="evento-recordatorio-ayuda" className="text-xs text-mut">
            {mover ? (
              <>
                <p>Quedará el {formatearFechaHoraCorta(aMover)}.</p>
                {seguiraVencido && <p>Seguirá vencido: el aviso saldrá enseguida.</p>}
              </>
            ) : (
              <p>El recordatorio se queda donde está.</p>
            )}
          </div>
        </div>
      )}

      {cambioInicio && consulta?.fallo && <p className="text-xs text-mut">{notaRecordatorioEventoNoConsultado()}</p>}

      {evento && (
        // Se abre ENCIMA: este formulario no se desmonta y lo escrito se conserva. Tamaño por defecto (40 px; 44 px en móvil), nunca `sm`.
        <Button
          type="button"
          variant="secondary"
          className="max-w-full max-sm:h-11 max-sm:w-full sm:self-start"
          title={etiquetaRecordatorio(consulta)}
          onClick={() => acciones.pedirRecordatorio(evento)}
          disabled={bloqueado}
        >
          <span className="min-w-0 truncate">{etiquetaRecordatorio(consulta)}</span>
        </Button>
      )}

      <ErrorDialogo mensaje={acciones.errorGuardar} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {evento ? (
          <Button type="button" variant="destructive" onClick={() => acciones.pedirBorrado(evento)} disabled={bloqueado}>
            Borrar evento
          </Button>
        ) : (
          <span />
        )}
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={acciones.cerrarDialogo} disabled={bloqueado}>
            Cancelar
          </Button>
          <Button type="submit" disabled={bloqueado || esperando}>
            {acciones.guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </form>
  )
}

type Registro = ReturnType<ReturnType<typeof useForm<ValoresEvento>>['register']>

/**
 * Día + hora de un extremo del evento, en una fila (el día se estira, la hora toma su ancho). Con «Todo el día» la
 * hora no se muestra; react-hook-form conserva su valor (`shouldUnregister` es false) por si se desmarca la casilla.
 * El error va debajo y los dos campos lo anuncian.
 */
function Lapso({
  id,
  error,
  etiquetaDia,
  etiquetaHora,
  conHora,
  dia,
  hora,
}: {
  id: string
  error: string | undefined
  etiquetaDia: string
  etiquetaHora: string
  conHora: boolean
  dia: Registro
  hora: Registro
}) {
  const idError = `${id}-error`
  const accesibles = { 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? idError : undefined }
  return (
    <div className="flex flex-col gap-1">
      <div className={conHora ? 'grid grid-cols-[1fr_auto] gap-3' : 'grid grid-cols-1'}>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${id}-dia`} className="text-sm font-medium">
            {etiquetaDia}
          </label>
          <input id={`${id}-dia`} type="date" className={CAMPO} {...accesibles} {...dia} />
        </div>
        {conHora && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-hora`} className="text-sm font-medium">
              {etiquetaHora}
            </label>
            <input id={`${id}-hora`} type="time" className={CAMPO} {...accesibles} {...hora} />
          </div>
        )}
      </div>
      {error && (
        <p id={idError} role="alert" className="text-xs text-tx">
          {error}
        </p>
      )}
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
