import type { ReactNode } from 'react'

/** Etiqueta + control + mensaje de error (`id-error`) de un campo de formulario. El control debe tener el `id`. */
export function Campo({ id, etiqueta, error, children }: { id: string; etiqueta: string; error?: string; children: ReactNode }) {
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
