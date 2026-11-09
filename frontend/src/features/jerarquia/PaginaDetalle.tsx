import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Aviso } from '@/components/Aviso'
import { PrioridadChip } from '@/components/PrioridadChip'
import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { useMensajeTemporal } from '@/features/agenda/useMensajeTemporal'
import type { ConfigJerarquia } from './config'
import { DialogosJerarquia } from './DialogosJerarquia'
import { filtrar, ordenar } from './filtros'
import type { ObjetivosDisponibles } from './ItemDialog'
import { ListaEnlaces } from './ListaEnlaces'
import { NoEncontrado } from './NoEncontrado'
import { SelectorEstado } from './SelectorEstado'
import type { ItemJerarquico } from './tipos'
import { useAccionesJerarquia } from './useAccionesJerarquia'
import { useListaJerarquia } from './useListaJerarquia'

/** Lo que la página presta a sus secciones: el aviso flotante, para que haya una sola región `status`. */
export interface ContextoDetalle {
  alMensaje: (mensaje: string) => void
}

interface Props<T extends ItemJerarquico, R> {
  config: ConfigJerarquia<T, R>
  /** El `:id` de la URL tal cual (puede no ser un número). */
  idParam: string | undefined
  /** Filas extra de los datos básicos (p. ej. el objetivo de un proyecto). */
  datosExtra?: (item: T, contexto: ContextoDetalle) => ReactNode
  /** Secciones propias de cada tipo, bajo los hijos (tareas ligadas, proyectos del objetivo…). */
  secciones?: (item: T, contexto: ContextoDetalle) => ReactNode
  /** Solo proyectos: los objetivos entre los que elegir al editar. */
  objetivos?: ObjetivosDisponibles
}

const ENLACE = 'rounded-sm underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/**
 * Detalle de un proyecto u objetivo. Se arma desde la lista completa (`['proyectos']` / `['objetivos']`), sin
 * consulta propia: editar o borrar desde aquí o desde la lista se ve en ambos sitios, y el nombre del padre y
 * los hijos directos salen de la misma lista. "No encontrado" = lista cargada sin ese id (o id no numérico).
 */
export function PaginaDetalle<T extends ItemJerarquico, R>({ config, idParam, datosExtra, secciones, objetivos }: Props<T, R>) {
  const numero = idParam !== undefined && /^\d+$/.test(idParam) ? Number(idParam) : null
  const lista = useListaJerarquia(config)
  const confirmacion = useMensajeTemporal()
  const navigate = useNavigate()
  const acciones = useAccionesJerarquia(config, {
    alMensaje: confirmacion.mostrar,
    // Sin filtro en el detalle: el elemento siempre se ve, cualquiera sea su estado.
    filtroEstado: 'todos',
    // Al borrar esta página deja de existir: se vuelve a la lista llevando el aviso.
    alBorrado: (_, mensaje) => void navigate(config.rutaBase, { state: { aviso: mensaje } }),
  })

  const item = numero === null ? undefined : lista.data?.find((i) => i.id === numero)
  const padre = item?.padreId != null ? lista.data?.find((i) => i.id === item.padreId) : undefined
  const hijos = item && lista.data ? ordenar(filtrar(lista.data.filter((i) => i.padreId === item.id && i.id !== item.id), { estado: 'todos', busqueda: '' })) : []

  const contexto: ContextoDetalle = { alMensaje: confirmacion.mostrar }

  const volver = (
    <Link to={config.rutaBase} className={`mb-4 inline-flex items-center gap-1 text-sm text-mut hover:text-tx ${ENLACE}`}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      Volver a {config.titulo}
    </Link>
  )

  const aviso = (
    <Aviso
      mensaje={confirmacion.mensaje}
      saliendo={confirmacion.saliendo}
      alCerrar={confirmacion.cerrar}
      alPausar={confirmacion.pausar}
      alReanudar={confirmacion.reanudar}
    />
  )

  if (numero === null || (lista.data && !item)) {
    return (
      <>
        {aviso}
        <NoEncontrado etiqueta={config.etiqueta} titulo={config.titulo} rutaBase={config.rutaBase} />
      </>
    )
  }

  if (!item) {
    return (
      <div>
        {aviso}
        {volver}
        {lista.isPending && <TextoVacio>{config.textos.cargando}</TextoVacio>}
        {lista.error && <ErrorEnLinea mensaje={lista.error.message} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {aviso}
      <div>
        {volver}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-4xl break-words">{item.nombre}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <SelectorEstado item={item} acciones={acciones} />
              {item.prioridad && <PrioridadChip prioridad={item.prioridad} />}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={acciones.pendiente} onClick={() => acciones.abrirEditar(item)}>
              Editar
            </Button>
            <Button type="button" variant="ghost" disabled={acciones.pendiente} onClick={() => acciones.pedirBorrado(item)}>
              Borrar
            </Button>
          </div>
        </header>
        {acciones.error && (
          <div className="mt-3">
            <ErrorEnLinea mensaje={acciones.error} />
          </div>
        )}
      </div>

      <Tarjeta titulo="Datos">
        <p className={item.descripcion ? 'mb-4 text-sm whitespace-pre-wrap' : 'mb-4 text-sm text-mut'}>{item.descripcion || 'Sin descripción.'}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-mut">Padre</dt>
          <dd>
            {item.padreId === null ? (
              'Sin padre'
            ) : (
              <Link to={`${config.rutaBase}/${item.padreId}`} className={ENLACE}>
                {padre?.nombre ?? `n.º ${item.padreId}`}
              </Link>
            )}
          </dd>
          {datosExtra?.(item, contexto)}
        </dl>
      </Tarjeta>

      <Tarjeta titulo={config.textos.hijos}>
        {hijos.length === 0 ? <TextoVacio>{config.textos.sinHijos}</TextoVacio> : <ListaEnlaces items={hijos} rutaBase={config.rutaBase} />}
      </Tarjeta>

      {secciones?.(item, contexto)}

      <DialogosJerarquia
        config={config}
        acciones={acciones}
        alMensaje={confirmacion.mostrar}
        todos={lista.data}
        listaConError={lista.isError}
        objetivos={objetivos}
      />
    </div>
  )
}
