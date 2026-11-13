import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Dialog al estilo shadcn sobre Radix: Radix se ocupa del foco dentro (queda atrapado), de Escape y de
// los roles ARIA. Devolver el foco al cerrar lo hacemos nosotros: sin un `Trigger` de Radix (los
// diálogos se abren con estado), Radix no sabe a quién devolverlo.

const Dialog = DialogPrimitive.Root

function DialogContent(props: React.ComponentProps<typeof DialogPrimitive.Content>) {
  // `DialogContent` se monta siempre (es hijo directo de `Dialog`); el `Portal` de Radix es quien monta
  // lo de adentro solo mientras el diálogo está abierto. Por eso la captura del foco va en el hijo.
  return (
    <DialogPrimitive.Portal>
      <ContenidoAbierto {...props} />
    </DialogPrimitive.Portal>
  )
}

function ContenidoAbierto({ className, children, onCloseAutoFocus, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  // Se monta al abrir, justo antes de que Radix mueva el foco adentro: lo que tiene el foco ahora es el
  // disparador. Se lee una sola vez.
  const [disparador] = React.useState(() => document.activeElement)

  function alCerrarFoco(e: Event) {
    onCloseAutoFocus?.(e)
    if (e.defaultPrevented) return // el consumidor decide a dónde va el foco
    e.preventDefault()
    if (disparador instanceof HTMLElement && disparador !== document.body && disparador.isConnected) disparador.focus()
  }

  return (
    <>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-tx/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          // Angosto: casi todo el ancho y alto con scroll interno; ancho: columna centrada.
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-card p-5 text-tx shadow-card outline-none sm:p-6',
          className,
        )}
        onCloseAutoFocus={alCerrarFoco}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Cerrar"
          className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full text-mut hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('pr-10 font-serif text-[22px] leading-tight', className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('mt-1 text-sm text-mut', className)} {...props} />
}

export { Dialog, DialogContent, DialogDescription, DialogTitle }
