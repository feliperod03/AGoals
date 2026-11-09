export function ErrorDialogo({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <p role="alert" className="rounded-xl border border-alta px-3 py-2 text-sm text-tx">
      {mensaje}
    </p>
  )
}
