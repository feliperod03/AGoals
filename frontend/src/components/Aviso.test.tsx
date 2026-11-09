import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SALIDA_MS, useMensajeTemporal } from '@/features/agenda/useMensajeTemporal'
import { Aviso } from './Aviso'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const MS = 1000

/** Aviso conectado al hook real, con botones para disparar mensajes. */
function Pagina() {
  const c = useMensajeTemporal(MS)
  return (
    <div>
      <button onClick={() => c.mostrar('Guardada en el cofre')}>uno</button>
      <button onClick={() => c.mostrar('Tarea cancelada')}>dos</button>
      <Aviso mensaje={c.mensaje} saliendo={c.saliendo} alCerrar={c.cerrar} alPausar={c.pausar} alReanudar={c.reanudar} />
    </div>
  )
}

// Con fake timers `userEvent` se cuelga (el asyncWrapper de RTL espera un setTimeout real): se usa `fireEvent`.
const clic = (elemento: HTMLElement) => fireEvent.click(elemento)
const cerrar = () => screen.getByRole('button', { name: 'Cerrar aviso' })

const avanzar = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

describe('Aviso', () => {
  it('la región viva existe aunque no haya mensaje, y es la única', () => {
    render(<Pagina />)
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument()
  })

  it('muestra el texto en la misma región, sin desmontarla', () => {
    render(<Pagina />)
    const region = screen.getByRole('status')
    clic(screen.getByText('uno'))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent('Guardada en el cofre')
  })

  it('un aviso nuevo reemplaza al anterior (no se apilan)', () => {
    render(<Pagina />)
    clic(screen.getByText('uno'))
    clic(screen.getByText('dos'))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Tarea cancelada')
    expect(screen.getAllByRole('button', { name: 'Cerrar aviso' })).toHaveLength(1)
  })

  it('desaparece solo: primero sale y luego se vacía', () => {
    render(<Pagina />)
    clic(screen.getByText('uno'))
    avanzar(MS - 1)
    expect(screen.getByRole('status')).toHaveTextContent('Guardada en el cofre')
    avanzar(1)
    // En la fase de salida el texto sigue (para que se vea el desvanecido).
    expect(screen.getByRole('status')).toHaveTextContent('Guardada en el cofre')
    expect(screen.getByRole('status').parentElement).toHaveAttribute('data-estado', 'saliendo')
    avanzar(SALIDA_MS)
    expect(screen.getByRole('status')).toHaveTextContent('')
    expect(screen.queryByRole('button', { name: 'Cerrar aviso' })).not.toBeInTheDocument()
  })

  it('«×» lo cierra', () => {
    render(<Pagina />)
    clic(screen.getByText('uno'))
    clic(cerrar())
    avanzar(SALIDA_MS)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('«×» es un botón enfocable (teclado)', () => {
    render(<Pagina />)
    clic(screen.getByText('uno'))
    // Es un <button> real y está en el orden de tabulación; Enter/Espacio sobre un botón dispara `click`.
    act(() => cerrar().focus())
    expect(cerrar()).toHaveFocus()
    expect(cerrar()).not.toHaveAttribute('tabindex', '-1')
    clic(cerrar())
    avanzar(SALIDA_MS)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('el puntero encima pausa el temporizador y al salir se reanuda', () => {
    render(<Pagina />)
    clic(screen.getByText('uno'))
    fireEvent.pointerEnter(cerrar())
    avanzar(60_000)
    expect(screen.getByRole('status')).toHaveTextContent('Guardada en el cofre')
    fireEvent.pointerLeave(cerrar())
    avanzar(1999) // tras reanudar queda visible al menos 2 s
    expect(screen.getByRole('status')).toHaveTextContent('Guardada en el cofre')
    avanzar(1 + SALIDA_MS)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('el foco dentro pausa el temporizador y al salir se reanuda', () => {
    render(<Pagina />)
    clic(screen.getByText('uno'))
    act(() => screen.getByRole('button', { name: 'Cerrar aviso' }).focus())
    avanzar(60_000)
    expect(screen.getByRole('status')).toHaveTextContent('Guardada en el cofre')
    act(() => screen.getByRole('button', { name: 'Cerrar aviso' }).blur())
    avanzar(5000 + SALIDA_MS)
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('respeta prefers-reduced-motion: todo el movimiento va con motion-safe', () => {
    render(<Pagina />)
    clic(screen.getByText('uno'))
    // jsdom no evalúa CSS ni matchMedia; se comprueba que ninguna clase de movimiento esté sin el prefijo.
    const clases = (screen.getByRole('status').parentElement as HTMLElement).className.split(/\s+/)
    const movimiento = clases.filter((c) => /(translate|slide-in|animate-in|zoom)/.test(c))
    expect(movimiento.length).toBeGreaterThan(0)
    for (const clase of movimiento) expect(clase).toMatch(/motion-safe:/)
  })

  it('el contenedor no captura clics y queda sobre el overlay de los diálogos', () => {
    render(<Pagina />)
    const contenedor = screen.getByRole('status').parentElement!.parentElement as HTMLElement
    expect(contenedor).toHaveClass('pointer-events-none', 'z-[60]')
  })
})
