import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router-dom'

import { ApiError } from '@/api/client'
import { Campo } from '@/components/Campo'
import { ErrorEnLinea } from '@/components/Tarjeta'
import { Button } from '@/components/ui/button'
import { CAMPO } from '@/features/cofre/estilos'
import { olvidarSalidaVoluntaria } from './limpiar'
import { PantallaCargando } from './PantallaCargando'
import { useLogin } from './useLogin'
import { useSesion } from './useSesion'
import { volverSeguro } from './volver'

interface Valores {
  email: string
  clave: string
  recordarme: boolean
}

const ENTRADA = `w-full ${CAMPO} h-10 max-sm:h-11`

function FormularioLogin() {
  const login = useLogin()
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors },
  } = useForm<Valores>({ defaultValues: { email: '', clave: '', recordarme: true } })

  // 429 o sin conexión: no hay campo al que volver. El botón se deshabilita mientras envía y el foco cae a `body`;
  // se devuelve a «Entrar» solo si se perdió (si la persona ya se movió a otro control, no se le quita).
  const botonEntrar = useRef<HTMLButtonElement>(null)
  const falloSinCampo = login.isError && !(login.error instanceof ApiError && login.error.status === 401)
  useEffect(() => {
    if (falloSinCampo && document.activeElement === document.body) botonEntrar.current?.focus()
  }, [falloSinCampo, login.error])

  // Solo las ediciones del usuario limpian el error del servidor (no el `resetField` que vacía la contraseña).
  const limpiarError = () => {
    if (login.isError) login.reset()
  }

  const enviar = handleSubmit(async (valores) => {
    if (login.isPending) return
    try {
      await login.mutateAsync({ email: valores.email.trim(), clave: valores.clave, recordarme: valores.recordarme })
    } catch (e) {
      // Contraseña mala: se vacía y se vuelve a ella (el email se conserva). 429 y fallos de red no tocan nada.
      if (e instanceof ApiError && e.status === 401) {
        resetField('clave')
        setFocus('clave')
      }
    }
  })

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Campo id="login-email" etiqueta="Email" error={errors.email?.message}>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          className={ENTRADA}
          {...register('email', { validate: (v) => v.trim() !== '' || 'Escribe tu email', onChange: limpiarError })}
        />
      </Campo>

      <Campo id="login-clave" etiqueta="Contraseña" error={errors.clave?.message}>
        <input
          id="login-clave"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.clave ? true : undefined}
          aria-describedby={errors.clave ? 'login-clave-error' : undefined}
          className={ENTRADA}
          {...register('clave', { required: 'Escribe tu contraseña', onChange: limpiarError })}
        />
      </Campo>

      <div className="flex items-start gap-3">
        <input
          id="login-recordarme"
          type="checkbox"
          aria-describedby="login-recordarme-ayuda"
          className="mt-0.5 size-4 accent-acc max-sm:size-6"
          {...register('recordarme')}
        />
        <div>
          <label htmlFor="login-recordarme" className="text-sm font-medium">
            Recordarme
          </label>
          <p id="login-recordarme-ayuda" className="text-xs text-mut">
            Mantener la sesión en este dispositivo durante 30 días
          </p>
        </div>
      </div>

      {login.error && <ErrorEnLinea mensaje={login.error.message} />}

      <Button ref={botonEntrar} type="submit" disabled={login.isPending} className="w-full max-sm:h-11">
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}

/** Pantalla de entrada, fuera del Layout. Con sesión ya iniciada va a `volver` (validado) o a «/». */
export function LoginPage() {
  const sesion = useSesion()
  const [params] = useSearchParams()

  // Ya llegamos a /login: la marca de «Salir» cumplió su función (ver `limpiar.ts`).
  useEffect(() => {
    olvidarSalidaVoluntaria()
  }, [])

  if (sesion.data) return <Navigate replace to={volverSeguro(params.get('volver'))} />
  if (sesion.isPending) return <PantallaCargando />

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-8">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center font-serif text-3xl font-semibold text-tx">AGoals</p>
        <section aria-labelledby="login-titulo" className="rounded-card bg-card p-6 shadow-card">
          <h1 id="login-titulo" data-foco-respaldo tabIndex={-1} className="mb-5 font-serif text-[22px] leading-tight text-tx">
            Entrar
          </h1>
          <FormularioLogin />
        </section>
      </div>
    </main>
  )
}
