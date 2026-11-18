/** Estado de carga mínimo mientras `/yo` responde: las páginas no se montan hasta saber si hay sesión. */
export function PantallaCargando() {
  return (
    <div role="status" className="grid min-h-screen place-items-center bg-bg text-sm text-mut">
      Cargando…
    </div>
  )
}
