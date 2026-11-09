import { Link } from 'react-router-dom'

import { Tarjeta } from '@/components/Tarjeta'

/** Detalle de un id que no existe (o ya se borró, o ni siquiera es un número). */
export function NoEncontrado({ etiqueta, titulo, rutaBase }: { etiqueta: string; titulo: string; rutaBase: string }) {
  return (
    <div>
      <h1 className="mb-6 text-4xl">{etiqueta} no encontrado</h1>
      <Tarjeta titulo="No existe">
        <p className="mb-3 text-sm text-mut">Ese enlace no corresponde a ningún elemento: puede que se haya borrado.</p>
        <Link to={rutaBase} className="text-sm font-medium underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          Volver a {titulo}
        </Link>
      </Tarjeta>
    </div>
  )
}
