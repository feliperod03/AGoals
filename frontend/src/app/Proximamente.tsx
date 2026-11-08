/** Marcador de las secciones que llegan en rebanadas posteriores. */
export function Proximamente({ titulo }: { titulo: string }) {
  return (
    <section>
      <h1 className="text-3xl">{titulo}</h1>
      <p className="mt-2 text-mut">Próximamente.</p>
    </section>
  )
}
