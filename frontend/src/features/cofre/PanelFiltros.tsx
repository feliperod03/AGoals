import { ArrowDownUp, ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CAMPO, FOCO } from './estilos'
import { FiltroVinculoCofre } from './FiltroVinculoCofre'
import { FiltrosActivos } from './FiltrosActivos'
import {
  MAX_ANCLADOS,
  PRESETS,
  alternarPreset,
  chipsDeFiltros,
  hayFiltrosActivos,
  presetActivo,
  presetPorId,
  rangoInvertido,
  type FiltroEstado,
  type FiltroFecha,
  type FiltroPrioridad,
  type FiltrosCofre,
  type NombresVinculo,
  type OrdenCofre,
  type PresetId,
  type SentidoCofre,
} from './filtros'

interface Props {
  filtros: FiltrosCofre
  alCambiarFiltros: (filtros: FiltrosCofre) => void
  alVolverALaVistaPorDefecto: () => void
  orden: OrdenCofre
  sentido: SentidoCofre
  alCambiarOrden: (orden: OrdenCofre) => void
  alInvertirSentido: () => void
  anclados: PresetId[]
  alCambiarAnclados: (ids: PresetId[]) => void
  proyectos: { id: number; nombre: string }[] | undefined
  objetivos: { id: number; nombre: string }[] | undefined
  errorListados: string | null
  /** Para rotular el chip del vínculo. */
  nombres: NombresVinculo
}

const ETIQUETA_SENTIDO: Record<OrdenCofre, Record<SentidoCofre, string>> = {
  fecha: { asc: 'Más cercanas primero', desc: 'Más lejanas primero' },
  prioridad: { desc: 'Alta primero', asc: 'Baja primero' },
  antiguedad: { asc: 'Más antiguas primero', desc: 'Más recientes primero' },
}

const ORDENES: { valor: OrdenCofre; texto: string }[] = [
  { valor: 'fecha', texto: 'Fecha' },
  { valor: 'prioridad', texto: 'Prioridad' },
  { valor: 'antiguedad', texto: 'Antigüedad' },
]

const boton = (activo: boolean) =>
  cn('rounded-full border px-3 py-1 text-sm', FOCO, activo ? 'border-acc bg-acc text-acc-tx' : 'border-line bg-card hover:bg-muted')

/** Búsqueda, accesos rápidos, orden y "Más filtros" (filtros completos y elección de accesos rápidos). */
export function PanelFiltros(p: Props) {
  const [abierto, setAbierto] = useState(false)
  const f = p.filtros
  const chips = chipsDeFiltros(f, p.anclados, p.nombres)
  const cambiar = (parche: Partial<FiltrosCofre>) => p.alCambiarFiltros({ ...f, ...parche })

  function alternarAncla(id: PresetId, marcado: boolean) {
    p.alCambiarAnclados(marcado ? [...p.anclados, id] : p.anclados.filter((a) => a !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium">
          Buscar por título
          <input type="search" className={CAMPO} value={f.busqueda} onChange={(e) => cambiar({ busqueda: e.target.value })} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Ordenar por" className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-mut" aria-hidden="true">
              Ordenar por
            </span>
            {ORDENES.map((o) => (
              <button key={o.valor} type="button" aria-pressed={p.orden === o.valor} className={boton(p.orden === o.valor)} onClick={() => p.alCambiarOrden(o.valor)}>
                {o.texto}
              </button>
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label={`Invertir el sentido (ahora: ${ETIQUETA_SENTIDO[p.orden][p.sentido]})`} onClick={p.alInvertirSentido}>
            <ArrowDownUp aria-hidden="true" />
            {ETIQUETA_SENTIDO[p.orden][p.sentido]}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {p.anclados.length > 0 && (
          <div role="group" aria-label="Accesos rápidos" className="flex flex-wrap items-center gap-2">
            {p.anclados.map((id) => {
              const preset = presetPorId(id)
              const activo = presetActivo(f, preset)
              return (
                <button key={id} type="button" aria-pressed={activo} className={boton(activo)} onClick={() => p.alCambiarFiltros(alternarPreset(f, preset))}>
                  {preset.etiqueta}
                </button>
              )
            })}
          </div>
        )}
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls="cofre-mas-filtros"
          onClick={() => setAbierto(!abierto)}
          className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-mut hover:bg-muted', FOCO)}
        >
          Más filtros{chips.length > 0 && ` (${chips.length})`}
          <ChevronDown className={cn('size-4 transition-transform', abierto && 'rotate-180')} aria-hidden="true" />
        </button>
        {hayFiltrosActivos(f) && (
          <Button type="button" variant="ghost" size="sm" onClick={p.alVolverALaVistaPorDefecto}>
            Volver a la vista por defecto
          </Button>
        )}
      </div>

      <FiltrosActivos chips={chips} alQuitar={(chip) => p.alCambiarFiltros({ ...f, ...chip.quitar })} />

      {abierto && (
        <div id="cofre-mas-filtros" className="flex flex-col gap-4 rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Fecha
              <select className={CAMPO} value={f.fecha} onChange={(e) => cambiar({ fecha: e.target.value as FiltroFecha })}>
                <option value="todas">Todas</option>
                <option value="con">Con fecha</option>
                <option value="sin">Sin fecha</option>
                <option value="atrasadas">Atrasadas</option>
                <option value="futuras">Futuras</option>
                <option value="rango">Rango de fechas</option>
              </select>
            </label>
            {f.fecha === 'rango' && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Desde
                  <input type="date" className={CAMPO} value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Hasta
                  <input type="date" className={CAMPO} value={f.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
                </label>
              </>
            )}
            <label className="flex flex-col gap-1 text-sm font-medium">
              Estado
              <select className={CAMPO} value={f.estado} onChange={(e) => cambiar({ estado: e.target.value as FiltroEstado })}>
                <option value="abiertas">Abiertas</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_PROGRESO">En progreso</option>
                <option value="EN_PAUSA">En pausa</option>
                <option value="HECHO">Hecha</option>
                <option value="CANCELADO">Cancelada</option>
                <option value="todas">Todas</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Prioridad
              <select className={CAMPO} value={f.prioridad} onChange={(e) => cambiar({ prioridad: e.target.value as FiltroPrioridad })}>
                <option value="cualquiera">Cualquiera</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
                <option value="ninguna">Sin prioridad</option>
              </select>
            </label>
          </div>
          {rangoInvertido(f) && (
            <p role="alert" className="text-sm text-tx">
              La fecha «Desde» es posterior a «Hasta»: no puede coincidir ninguna tarea.
            </p>
          )}

          <FiltroVinculoCofre vinculo={f.vinculo} alCambiar={(vinculo) => cambiar({ vinculo })} proyectos={p.proyectos} objetivos={p.objetivos} error={p.errorListados} />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Accesos rápidos (hasta {MAX_ANCLADOS})</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {PRESETS.map((preset) => {
                const marcado = p.anclados.includes(preset.id)
                return (
                  <label key={preset.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={marcado}
                      disabled={!marcado && p.anclados.length >= MAX_ANCLADOS}
                      onChange={(e) => alternarAncla(preset.id, e.target.checked)}
                    />
                    {preset.etiqueta}
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}
