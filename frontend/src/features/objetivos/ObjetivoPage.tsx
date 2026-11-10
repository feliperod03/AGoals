import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { ErrorEnLinea, Tarjeta, TextoVacio } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { CONFIG_OBJETIVO, CONFIG_PROYECTO } from '@/features/jerarquia/config'
import { ItemDialog } from '@/features/jerarquia/ItemDialog'
import { ListaEnlaces } from '@/features/jerarquia/ListaEnlaces'
import { PaginaDetalle, type ContextoDetalle } from '@/features/jerarquia/PaginaDetalle'
import { TareasLigadas } from '@/features/jerarquia/TareasLigadas'
import { ordenar } from '@/features/jerarquia/filtros'
import { esAbierto } from '@/features/jerarquia/tipos'
import type { EstadoItemDialog } from '@/features/jerarquia/useAccionesJerarquia'
import { useCambiarObjetivo } from '@/features/jerarquia/useCambiarObjetivo'
import { useListaJerarquia } from '@/features/jerarquia/useListaJerarquia'
import type { Objetivo } from '@/types/objetivo'
import type { Proyecto } from '@/types/proyecto'
import { AgregarProyectoDialog } from './AgregarProyectoDialog'

/** Detalle de un objetivo (8.4a): datos, subobjetivos, sus proyectos (8.4a2: agregar y quitar) y las tareas ligadas directamente (8.4b: quitar y vincular). */
export function ObjetivoPage() {
  const { id } = useParams()
  return (
    <PaginaDetalle
      config={CONFIG_OBJETIVO}
      idParam={id}
      secciones={(o, contexto) => (
        <>
          <ProyectosDelObjetivo objetivo={o} alMensaje={contexto.alMensaje} />
          <TareasLigadas
            campo="objetivoId"
            id={o.id}
            titulo="Tareas ligadas directamente"
            aclaracion="Las tareas de sus proyectos se ven en cada proyecto."
            textoVacio="Este objetivo no tiene tareas ligadas directamente."
            nombre={o.nombre}
            abierto={esAbierto(o.estado)}
            alMensaje={contexto.alMensaje}
          />
        </>
      )}
    />
  )
}

/**
 * Los proyectos con `objetivoId` = este objetivo (de la misma lista que usa la página Proyectos), con «Agregar
 * proyecto» (vincular uno existente o crear uno nuevo) y «Quitar» por fila (el proyecto queda sin objetivo; no se borra).
 */
function ProyectosDelObjetivo({ objetivo, alMensaje }: { objetivo: Objetivo; alMensaje: ContextoDetalle['alMensaje'] }) {
  const proyectos = useListaJerarquia(CONFIG_PROYECTO)
  // Misma consulta que el detalle: nombra el objetivo actual de los candidatos y alimenta el formulario de creación.
  const objetivos = useListaJerarquia(CONFIG_OBJETIVO)
  const quitar = useCambiarObjetivo({ alMensaje })
  const [eligiendo, setEligiendo] = useState(false)
  const [creando, setCreando] = useState<EstadoItemDialog<Proyecto> | null>(null)

  const propios = ordenar((proyectos.data ?? []).filter((p) => p.objetivoId === objetivo.id))
  // Como el select del proyecto, solo se ofrece agregar a un objetivo abierto.
  const puedeAgregar = esAbierto(objetivo.estado)

  return (
    <Tarjeta titulo="Proyectos del objetivo">
      {proyectos.isPending && <TextoVacio>{CONFIG_PROYECTO.textos.cargando}</TextoVacio>}
      {proyectos.error && <ErrorEnLinea mensaje={proyectos.error.message} />}
      {proyectos.data && propios.length === 0 && <TextoVacio>Este objetivo no tiene proyectos.</TextoVacio>}
      {propios.length > 0 && (
        <ListaEnlaces
          items={propios}
          rutaBase={CONFIG_PROYECTO.rutaBase}
          accion={(p) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Quitar «${p.nombre}» del objetivo`}
              disabled={quitar.pendiente}
              onClick={() => quitar.cambiar({ proyecto: p, destino: null, nombreAnterior: objetivo.nombre })}
            >
              Quitar
            </Button>
          )}
        />
      )}
      {quitar.error && (
        <div className="mt-3">
          <ErrorEnLinea mensaje={quitar.error} />
        </div>
      )}
      {puedeAgregar && (
        <div className="mt-4">
          <Button type="button" variant="secondary" disabled={quitar.pendiente} onClick={() => setEligiendo(true)}>
            Agregar proyecto
          </Button>
        </div>
      )}

      <AgregarProyectoDialog
        objetivo={objetivo}
        abierto={eligiendo}
        alCerrar={() => setEligiendo(false)}
        alCrearNuevo={() => setCreando({ iniciales: { objetivoId: String(objetivo.id) } })}
        proyectos={proyectos.data}
        proyectosConError={proyectos.isError}
        objetivos={objetivos.data}
        alMensaje={alMensaje}
      />
      <ItemDialog
        config={CONFIG_PROYECTO}
        abierto={creando}
        alCerrar={() => setCreando(null)}
        alGuardar={alMensaje}
        todos={proyectos.data}
        listaConError={proyectos.isError}
        objetivos={{ lista: objetivos.data, error: objetivos.isError }}
      />
    </Tarjeta>
  )
}
