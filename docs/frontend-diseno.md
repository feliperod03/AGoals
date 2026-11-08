# AGoals: decisiones de diseño del frontend (rebanada 8)

> Fijadas el 7/11/2026; actualizadas el 8/11/2026 (cofre, estado de las rebanadas). Complementa a `agoals-brief.md`; si se contradicen, avisar.

## Stack
- Vite + React + **TypeScript (strict)**.
- TanStack Query (datos del servidor; polling de `/recordatorios/vencidos` con `refetchInterval`).
- React Router.
- Tailwind + shadcn/ui (componentes copiados al repo, no librería opaca).
- date-fns (todo el manejo de fechas en `src/lib/fechas.ts`, con tests).
- react-hook-form (zod solo si hace falta). Se instala en 8.2a.
- `@radix-ui/react-dialog` (vía el Dialog de shadcn): aprobada para 8.2a, por el foco y la accesibilidad de los diálogos.
- Vitest + Testing Library.
- Fuentes autoalojadas con paquetes `@fontsource` (Fraunces e Inter).
- **Lista cerrada de dependencias:** cualquier otra requiere aprobación de Felipe.
- Descartados: Next.js, Redux/Zustand, MUI/Ant, axios, generar tipos desde OpenAPI (exigiría springdoc en el backend).

## Conexión con el backend
- Proxy de desarrollo de Vite: `server.proxy['/api'] -> http://localhost:8080`. El frontend usa rutas relativas. No hay CORS ni cambios en Spring.
- Si en el despliegue quedan en dominios distintos: rewrite/reverse proxy, o recién ahí CORS en el backend.
- Query params siempre con `URLSearchParams` (el `+` del desfase horario).
- Fechas con desfase: helper propio (`2026-11-10T15:00:00-03:00`), nunca `toISOString()` (da UTC). `hoy()`, `ahora()` y `rangoDelDia()` (00:00 a 00:00 del día siguiente) en `lib/fechas.ts`.

## Estructura de `frontend/`
```
frontend/
├── vite.config.ts
└── src/
    ├── app/          router, layout, providers
    ├── api/          client.ts + un archivo por dominio
    ├── features/     agenda, cofre, recomendacion, proyectos, objetivos, ideas, recordatorios, calendario
    ├── components/ui/  shadcn
    ├── lib/          fechas.ts, utils
    └── types/        DTOs en TypeScript
```
Capas: componentes -> hooks de `features/` -> `api/`. Solo `api/` llama a `fetch`.

## Idioma
- Interfaz en español.
- Código: inglés para lo técnico/genérico (`Button`, `ApiClient`, `useDebounce`, `formatDate`); español para el dominio y lo que viene de la API (`Tarea`, `useTareasDelDia`, `marcarHecha`, `fechaHoraInicio`).

## Cofre (decidido el 8/11/2026)
Lugar para tareas que hay que hacer "en algún momento", sin fecha. **No requiere cambios en el backend**: una tarea sin `fecha` ya es "sin agendar" y la recomendación ya las incluye (con o sin proyecto/objetivo).
- **Qué es:** todas las tareas abiertas sin fecha (PENDIENTE, EN_PROGRESO, EN_PAUSA), sean sueltas, de proyecto o de objetivo. Filtros por tipo (sueltas / de proyecto / de objetivo), con "Sueltas" como idea inicial a evaluar al diseñarlo.
- **Nombre:** "Cofre", con subtítulo explicativo ("Tareas sin fecha, para cuando tengas un hueco"). Puede cambiarse después solo en el frontend.
- **Crear:** en el formulario de nueva tarea (8.2a), si la fecha queda vacía la tarea va al cofre y el formulario lo dice ("Sin fecha: se guarda en el cofre").
- **Recomendación (8.3):** las tareas del cofre ya aparecen; se marcan visualmente.
- **Vista propia (8.3b):** entrada "Cofre" en la barra lateral, con las tareas ordenadas por prioridad o antigüedad y botón "Agendar" que reutiliza `PATCH /agendar`.
- **Datos:** `GET /api/tareas` filtrando en el cliente (abiertas y `fecha == null`); suficiente con un solo usuario.
- **Opcional:** contador "Cofre: N tareas" en Hoy que lleve a la vista.
- **Consecuencia conocida:** hasta que lleguen 8.3 y 8.3b, una tarea guardada en el cofre no se ve listada en ninguna pantalla.

## Orden de rebanadas
- 8.0 Esqueleto: hecha (commit `07c1c25`).
- 8.1 Agenda del día en lectura (tareas + eventos, lista del día y horas, próximos recordatorios y eventos): hecha (commit `e9ba44d`).
- 8.2a Crear y editar tareas (diálogo con formulario; fecha vacía -> cofre; revisar el riesgo del `PUT` antes de editar).
- 8.2b Acciones rápidas (hecha, reabrir, posponer, borrar; aviso al cerrar una tarea con recordatorio; errores 409 legibles).
- 8.3 Recomendación (+ agendar con/sin subtareas; tareas del cofre marcadas).
- 8.3b Cofre (vista propia con filtros y agendar).
- 8.4 Proyectos, objetivos e ideas.
- 8.5 Recordatorios (polling de vencidos, aviso al cerrar tarea con recordatorio).
- 9 Calendario (librería a decidir entonces).

Sesiones con Sonnet; `/clear` entre rebanadas. Escritorio primero, móvil después (layout responsive desde el inicio, PWA más adelante).

## Estilo visual (decidido: par A)
Boceto de referencia: canvas "AGoals — Pantalla Hoy (claro y oscuro)" en claude.ai.
- **Pantalla Hoy:** la agenda es el centro (lista del día sin hora + planificación por horas 08-21 con línea de "ahora"). Columna lateral con los 3 próximos recordatorios y los 3 próximos eventos (los que haya; estado vacío "Aún no tienes recordatorios/eventos").
- Barra lateral: Hoy, Calendario, Proyectos, Objetivos, Ideas (y Cofre cuando llegue 8.3b). Botones "Recomendación" (secundario) y "Nueva tarea" (primario).
- **Tipografía:** títulos y números grandes en **Fraunces** (serif suave); todo lo pequeño (chips, horas, fechas, etiquetas) en **Inter** con cifras tabulares. Texto pequeño mínimo 12 px.
- Tarjetas de bordes redondeados (~18 px), sombra suave. Dorado solo como acento.
- Chips de prioridad distintos en luminosidad, no solo en color: ALTA (sólido oscuro/rojizo), MEDIA (beige dorado), BAJA (contorno).
- Tareas planificadas en beige y eventos en azul marino (invertido en oscuro), con la etiqueta TAREA/EVENTO.

### Tokens (variables CSS; los valores son los del boceto y pasan 4,5:1 en todo texto)
| Token | Claro | Oscuro |
|---|---|---|
| bg | #F3ECDD | #101826 |
| side | #ECE2CE | #0C121D |
| card | #FBF7EE | #172236 |
| line | #DDD0B5 | #26334B |
| tx | #2B2418 | #EDE3D0 |
| mut | #655942 | #A9A08C |
| acc / acc-tx | #8A6A3A / #FFFFFF | #D8C3A0 / #17202F |
| gold (iconos) | #A9803F | #D8C3A0 |
| alta bg / tx | #8C3B24 / #FFFFFF | #EBB8A1 / #34150A |
| media bg / tx | #E6CF9C / #4A3A12 | #CDB98A / #2A2310 |
| baja borde / tx | #8F8366 / #5A4F39 | #6F7A92 / #C9C1AF |
| tarea bg / tx | #E9DABB / #33290F | #24334F / #EDE3D0 |
| evento bg / tx | #243350 / #F3ECDD | #D8C3A0 / #17202F |
| ahora / tx | #B5452B / #FFFFFF | #F08A6A / #2A1007 |

## Pendiente de decidir (de Felipe)
- Tarjeta de objetivos con porcentaje de progreso: el backend no lo calcula (requeriría endpoint nuevo). Para la v1: lista de objetivos con estado y prioridad.
- Librería del calendario (rebanada 9).
- Filtro por defecto de la vista del cofre (todas vs. solo sueltas).
- Planificación por horas: un evento que cruza la medianoche estira el rango a 00:00 y deja una franja larga vacía; posible mejora futura: plegar las horas vacías.
- Etiquetas de prioridad: hoy se ven "Alta/Media/Baja"; el boceto decía "ALTA/MEDIA/BAJA" (cosmético).
