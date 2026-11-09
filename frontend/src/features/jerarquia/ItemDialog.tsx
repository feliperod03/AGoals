import { useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CAMPO } from '@/features/cofre/estilos'
import { candidatosPadre, opcionesObjetivo } from './candidatosPadre'
import type { ConfigJerarquia } from './config'
import { MAX_NOMBRE, valoresIniciales, type ValoresItem } from './formulario'
import { mensajeCreado, mensajeGuardado } from './mensajes'
import { SelectorPadre } from './SelectorPadre'
import { ESTADOS, ETIQUETA_ESTADO, type ItemJerarquico } from './tipos'
import { useGuardarJerarquia, type EstadoItemDialog } from './useAccionesJerarquia'

/** Objetivos que puede elegir un proyecto; `lista` es `undefined` mientras cargan o si fallaron. */
export interface ObjetivosDisponibles {
  lista: ItemJerarquico[] | undefined
  error: boolean
}

interface Props<T extends ItemJerarquico, R> {
  config: ConfigJerarquia<T, R>
  /** Cerrado si es `null`. */
  abierto: EstadoItemDialog<T> | null
  alCerrar: () => void
  /** Se llama tras guardar con el mensaje de confirmación (para el aviso de la página). */
  alGuardar: (mensaje: string) => void
  /** La lista completa, para ofrecer candidatos a padre; `undefined` mientras carga. */
  todos: T[] | undefined
  listaConError: boolean
  /** Solo proyectos: habilita el selector de objetivo. */
  objetivos?: ObjetivosDisponibles
}

/** Diálogo para crear o editar un proyecto u objetivo (mismo formulario). Se monta de nuevo cada vez que se abre. */
export function ItemDialog<T extends ItemJerarquico, R>({ abierto, alCerrar, ...resto }: Props<T, R>) {
  // Lo escribe el selector de padre: con la lista abierta, Escape cierra solo la lista y no el diálogo.
  // Radix escucha Escape en el documento (fase de captura), antes que cualquier onKeyDown de React.
  const selectorAbierto = useRef(false)
  return (
    <Dialog open={abierto !== null} onOpenChange={(open) => !open && alCerrar()}>
      <DialogContent onEscapeKeyDown={(e) => selectorAbierto.current && e.preventDefault()}>
        {abierto && <Formulario item={abierto.item} iniciales={abierto.iniciales} alCerrar={alCerrar} selectorAbierto={selectorAbierto} {...resto} />}
      </DialogContent>
    </Dialog>
  )
}

interface PadreElegido {
  id: number | null
  nombre: string | null
}

function Formulario<T extends ItemJerarquico, R>({
  config,
  item,
  iniciales,
  alCerrar,
  alGuardar,
  todos,
  listaConError,
  objetivos,
  selectorAbierto,
}: Omit<Props<T, R>, 'abierto'> & { item: T | undefined; iniciales: Partial<ValoresItem> | undefined; selectorAbierto: MutableRefObject<boolean> }) {
  const guardar = useGuardarJerarquia(config)
  // `undefined` = el usuario no tocó el campo "Padre": el PUT conserva el padreId original.
  const [padreElegido, setPadreElegido] = useState<PadreElegido>()
  const valoresPorDefecto: ValoresItem = { ...valoresIniciales(item), ...iniciales }
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ValoresItem>({ defaultValues: valoresPorDefecto })

  // Al editar sale del propio item; al crear con objetivo prefijado, de `iniciales`: así figura entre las opciones
  // aunque esté cerrado o la lista de objetivos no haya cargado.
  const objetivoActual = valoresPorDefecto.objetivoId === '' ? null : Number(valoresPorDefecto.objetivoId)
  const opcionesDeObjetivo = useMemo(() => (objetivos ? opcionesObjetivo(objetivos.lista, objetivoActual) : []), [objetivos, objetivoActual])

  const enviar = handleSubmit((valores) => {
    const request = config.aRequest(valores, item, padreElegido?.id)
    guardar.mutate(
      { id: item?.id, request },
      {
        onSuccess: () => {
          const nombre = valores.nombre.trim()
          alGuardar(item ? mensajeGuardado(nombre) : mensajeCreado(config.etiqueta, nombre))
          alCerrar()
        },
      },
    )
  })

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <div>
        <DialogTitle>{item ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}</DialogTitle>
        <DialogDescription>{item ? 'Cambia lo que necesites y guarda.' : `Ponle nombre a tu ${config.singular}.`}</DialogDescription>
      </div>

      <Campo id="item-nombre" etiqueta="Nombre" error={errors.nombre?.message}>
        <input
          id="item-nombre"
          type="text"
          className={CAMPO}
          aria-invalid={errors.nombre ? true : undefined}
          aria-describedby={errors.nombre ? 'item-nombre-error' : undefined}
          {...register('nombre', {
            validate: (v) => {
              if (!v.trim()) return 'El nombre es obligatorio'
              if (v.trim().length > MAX_NOMBRE) return `El nombre admite como máximo ${MAX_NOMBRE} caracteres`
              return true
            },
          })}
        />
      </Campo>

      <Campo id="item-descripcion" etiqueta="Descripción">
        <textarea id="item-descripcion" rows={3} className={CAMPO} {...register('descripcion')} />
      </Campo>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo id="item-estado" etiqueta="Estado">
          <select id="item-estado" className={CAMPO} {...register('estado')}>
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETA_ESTADO[estado]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="item-prioridad" etiqueta="Prioridad">
          <select id="item-prioridad" className={CAMPO} {...register('prioridad')}>
            <option value="">Ninguna</option>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
          </select>
        </Campo>
      </div>

      {objetivos && (
        <div className="flex flex-col gap-1">
          <Campo id="item-objetivo" etiqueta="Objetivo">
            <select id="item-objetivo" className={CAMPO} {...register('objetivoId')}>
              <option value="">Sin objetivo</option>
              {opcionesDeObjetivo.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.texto}
                </option>
              ))}
            </select>
          </Campo>
          {objetivos.error && <p className="text-xs text-mut">No se pudo cargar la lista de objetivos; se conserva el actual.</p>}
        </div>
      )}

      <CampoPadre
        config={config}
        item={item}
        todos={todos}
        listaConError={listaConError}
        elegido={padreElegido}
        alElegir={setPadreElegido}
        bloqueado={guardar.isPending}
        abiertoRef={selectorAbierto}
      />

      {guardar.error && (
        <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
          {guardar.error.message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={alCerrar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

/**
 * Campo "Padre". Sin la lista (cargando o fallida) queda deshabilitado mostrando el padre actual, y como
 * `elegido` sigue sin definir el PUT conserva el padreId original.
 */
function CampoPadre<T extends ItemJerarquico, R>({
  config,
  item,
  todos,
  listaConError,
  elegido,
  alElegir,
  bloqueado,
  abiertoRef,
}: {
  config: ConfigJerarquia<T, R>
  item: T | undefined
  todos: T[] | undefined
  listaConError: boolean
  elegido: PadreElegido | undefined
  alElegir: (padre: PadreElegido) => void
  bloqueado: boolean
  abiertoRef: MutableRefObject<boolean>
}) {
  const candidatos = useMemo(
    () => (todos ? candidatosPadre(item ?? null, todos, { subDe: config.textos.subDe, principal: config.textos.principal }) : undefined),
    [item, todos, config.textos.subDe, config.textos.principal],
  )

  const padreOriginal = item?.padreId ?? null
  const nombreActual = elegido
    ? elegido.nombre
    : padreOriginal === null
      ? null
      : (todos?.find((i) => i.id === padreOriginal)?.nombre ?? `n.º ${padreOriginal}`)

  return (
    <SelectorPadre
      nombreActual={nombreActual}
      idActual={elegido ? elegido.id : padreOriginal}
      candidatos={candidatos}
      deshabilitado={!todos || listaConError || bloqueado}
      nota={listaConError ? `No se pudo cargar la lista de ${config.plural}; el padre se conserva.` : !todos ? `Cargando ${config.plural}…` : undefined}
      textoVacio={`Ningún ${config.singular} coincide.`}
      abiertoRef={abiertoRef}
      alElegir={(id, nombre) => alElegir({ id, nombre })}
    />
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
