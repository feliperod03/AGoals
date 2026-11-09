# AGoals: decisiones de diseño del frontend (rebanada 8)

> Fijadas el 7/11/2026; actualizadas el 9/11/2026 (8.3b hecha, 8.2d y pulido 1 decididos). Complementa a `agoals-brief.md`; si se contradicen, avisar.

## Stack
- Vite + React + **TypeScript (strict)**.
- TanStack Query (datos del servidor; polling de `/recordatorios/vencidos` con `refetchInterval`).
- React Router.
- Tailwind + shadcn/ui (componentes copiados al repo, no librería opaca).
- date-fns (todo el manejo de fechas en `src/lib/fechas.ts`, con tests).
- react-hook-form (zod solo si hace falta). Se instala en 8.2a.
- `@radix-ui/react-dialog` (vía el Dialog de shadcn): aprobada para 8.2a, por el foco y la accesibilidad de los diálogos.
- `@radix-ui/react-dropdown-menu` (vía el DropdownMenu de shadcn): aprobada para 8.2b, por el teclado y los roles ARIA del menú de acciones de cada tarea.
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
    ├── components/   componentes compartidos (PrioridadChip, Tarjeta…) y ui/ (shadcn)
    ├── features/     agenda, cofre, recomendacion, proyectos, objetivos, ideas, recordatorios, calendario
    ├── lib/          fechas.ts, texto.ts, utils
    └── types/        DTOs en TypeScript
```
Capas: componentes -> hooks de `features/` -> `api/`. Solo `api/` llama a `fetch`.

## Idioma
- Interfaz en español.
- Código: inglés para lo técnico/genérico (`Button`, `ApiClient`, `useDebounce`, `formatDate`); español para el dominio y lo que viene de la API (`Tarea`, `useTareasDelDia`, `marcarHecha`, `fechaHoraInicio`). Sin `ñ` en identificadores.

## Subtareas (decidido el 9/11/2026; rebanada 8.2d, próxima)
Hoy el frontend no puede crear subtareas (el backend sí: `padreId` en `TareaRequest`, con validación de padre existente y sin ciclos). Es un hueco funcional porque la tarea unificada y las vistas de recomendación y cofre ya anidan subtareas.
- Ítem **"Agregar subtarea"** en el menú de acciones de cada tarea abierta (Hoy y Cofre) y en el diálogo de edición (para las tareas de la planificación por horas, que no tienen menú). Abre el diálogo de nueva tarea titulado "Nueva subtarea de «X»" con `padreId` fijado; el resto del formulario es el de siempre.
- Una subtarea nueva sin fecha va al cofre y se ve anidada bajo su madre si la madre está en la vista.
- Fuera de alcance: cambiar la madre de una tarea existente, asignar proyecto u objetivo (8.4).

## Posponer (hecha en 8.2c; commit `2a78695`)
Antes "Posponer" mandaba un PATCH sin cuerpo y el backend sumaba un día a la fecha **de la tarea** (una atrasada podía seguir atrasada). El backend ya aceptaba `{fecha}` opcional, así que no hubo cambios de backend.
- **Diálogo pequeño** (`PosponerDialog`, montado una vez en `DialogosAcciones`; se abre desde el menú de la lista o desde el diálogo de edición) con tres opciones:
  - **Mañana:** manda `hoy + 1` explícito. Solo se ofrece si la fecha actual de la tarea es anterior a mañana (el backend exige una fecha posterior a la actual).
  - **Elegir fecha:** `input type="date"` nativo (sin dependencias nuevas), con mínimo = el mayor entre (fecha de la tarea + 1) y (hoy + 1).
  - **Dejar sin fecha:** PUT de la tarea con `fecha`, `horaInicio` y `horaFin` en null, reenviando `estado` y `padreId` (`requestSinFecha`). No suma `veces_pospuesta`. La tarea queda "sin fecha" y aparece en el Cofre y en la recomendación.
- Siempre se manda la fecha explícita; no se depende del "+1" por defecto del backend.
- Solo para tareas abiertas con fecha (`puedePosponer`). Las cerradas dan 409; las sin fecha se agendan desde la recomendación o el cofre.
- Si falla, el diálogo queda abierto con el error; mientras hay una mutación no se puede cerrar.
- **Pendientes conocidos:** el recordatorio pendiente no se mueve con la tarea; el error de posponer también se ve en el cartel de la lista; cancelar el selector no limpia el error.

## Recomendación (8.3 hecha; commit `f2d0052`)
- Botón secundario "Recomendación" en el encabezado de Hoy; abre un diálogo (Dialog de shadcn) con tareas abiertas sin fecha o atrasadas.
- Controles: orden (Prioridad / Antigüedad), botón de sentido con etiqueta en palabras ("Alta primero", "Más antiguas primero"…), filtro Todos / Proyecto / Objetivo con búsqueda por nombre en el cliente (sin mayúsculas ni tildes) y chip con "×". Un solo filtro a la vez.
- Filas: marca "Sin fecha" / "Atrasada desde <día>" (texto más ícono), chip de prioridad, nombre del proyecto u objetivo si el listado ya cargó, subtareas anidadas como vista previa.
- Agendar: botón por raíz "Agendar «título» para hoy" y checkbox "Incluir N subtareas" (N cuenta todos los niveles; marcado por defecto). Aviso "«X» agendada para hoy (con N subtareas)", con N = tareas devueltas − 1. El diálogo sigue abierto.
- Región `role="status"` propia dentro del diálogo (Radix deja el resto de la página con `aria-hidden`).
- **Pendiente (8.3c, después de la 5c de backend):** toggle "Incluir próximos N días" para ver tareas con fecha futura y adelantarlas a hoy. El uso principal sigue siendo sin fecha y atrasadas. Mientras tanto, el Cofre cubre el caso con su filtro "Futuras" y la acción "Agendar para hoy".

## Cofre (hecho en 8.3b; commit `a33fcce`)
Inventario de **todas** las tareas, con filtros. Nació como lugar para las tareas "de algún momento" (sin fecha), y ese uso es la vista por defecto. **No requirió cambios en el backend** (`GET /api/tareas`, todo se filtra, ordena y anida en el cliente; clave de query `['tareas', 'todas']`).
- **Vista por defecto:** abiertas sin fecha. "Volver a la vista por defecto" restablece todo.
- **Filtros** (se combinan con AND): fecha (todas / con / sin / atrasadas / futuras / rango inclusivo, las sin fecha quedan fuera del rango), estado (abiertas por defecto, cualquiera de los cinco o todas), prioridad (cualquiera / alta / media / baja / ninguna), vínculo directo (cualquiera / suelta / de un proyecto / de un objetivo, con `<select>` nativos y sin búsqueda por nombre) y búsqueda por título (sin mayúsculas ni tildes).
- **Orden:** por fecha (asc, sin fecha al final), prioridad (alta primero, sin prioridad al final) o antigüedad (fecha de creación; asc = más antiguas primero), con botón de sentido. Al cambiar de orden el sentido vuelve al natural. Por defecto prioridad desc. Desempate por id.
- **Accesos rápidos:** hasta 3, de una sola dimensión (Sin fecha, Con fecha, Atrasadas, Futuras, Prioridad alta/media, Sin prioridad, Pendientes, En progreso, Sueltas). Pulsar uno reemplaza solo su dimensión y suma al resto; si ya está activo vuelve esa dimensión a neutro (apagar uno de estado vuelve a "abiertas", no a "todas"). Por defecto: Sin fecha, Atrasadas, Prioridad alta. Se eligen en "Más filtros" y se guardan en `localStorage['agoals:cofre:anclados']` (lectura y escritura en try/catch, con validación; el estado actual de los filtros no se persiste).
- **Subtareas anidadas:** una tarea que cumple y cuya madre también se anida bajo ella; si la madre no cumple, la hija sube a raíz con "Subtarea de «madre»"; una madre que no cumple no se muestra; "+N subtareas ocultas por el filtro". Protegido contra ciclos y padres inexistentes.
- **Acciones:** las de Hoy (editar, hecha, reabrir, posponer, cancelar, reactivar, borrar) más "Agendar para hoy" en abiertas sin fecha, atrasadas o futuras. Sin subtareas candidatas agenda directo (el error 409/400 sale en el cartel de la página); con candidatas abre un diálogo con "Incluir N subtareas". "Nueva tarea" en el encabezado. `subtareasCandidatas` replica en el cliente la regla de "Agendar con subtareas" del backend.
- **Pendiente (pulido 1):** hoy los filtros activos de "Más filtros" quedan invisibles al plegar el panel y parece que "faltan tareas". Se resuelve con una **fila de chips** de los filtros activos (los que no son accesos rápidos), cada uno con "×", visible aunque el panel esté plegado, un contador en el botón "Más filtros (N)" y un texto de vacío que diga qué filtros hay activos. (Se descartó desmarcarlos al plegar: se perdería la configuración justo al querer ver más lista.)
- **Opcional:** contador en Hoy que lleve al cofre.
- **No hay posposición automática:** una tarea no completada queda en su fecha como atrasada; se ve en el cofre (filtro "Atrasadas") y en la recomendación.

## Orden de rebanadas
- 8.0 Esqueleto: hecha (commit `07c1c25`).
- 8.1 Agenda del día en lectura (tareas + eventos, lista del día y horas, próximos recordatorios y eventos): hecha (commit `e9ba44d`).
- 8.2a Crear y editar tareas, hecha (diálogo con formulario; fecha vacía -> cofre; revisar el riesgo del `PUT` antes de editar).
- 8.2b Acciones rápidas, hecha (hecha, reabrir, posponer, cancelar, reactivar, borrar con confirmación; pregunta por el recordatorio pendiente al marcar hecha o cancelar; errores 409 legibles).
- 8.3 Recomendación, hecha (commit `f2d0052`).
- 8.2c Posponer con opciones (mañana / elegir fecha / dejar sin fecha), solo frontend: hecha (commit `2a78695`).
- Refactor previo al cofre: hecho (commit `1e3256f`).
- 8.3b Cofre, hecha (commit `a33fcce`).
- **8.2d Crear subtareas**, solo frontend: **próxima**.
- **P1 Pulido 1:** aviso flotante animado y chips de filtros activos en el Cofre.
- 8.4 Proyectos, objetivos e ideas (incluye asignar tareas a proyectos/objetivos; partirla en 8.4a/b/c).
- 8.5 Recordatorios (polling de vencidos, aviso al cerrar tarea con recordatorio).
- 9 Calendario (librería a decidir entonces).
- 5c (backend) + 8.3c: tareas futuras en la recomendación, tras usar el cofre.
- Pulido 2 al final.

Sesiones con Sonnet; `/clear` entre rebanadas. Escritorio primero, móvil después (layout responsive desde el inicio, PWA más adelante).

## Estilo visual (decidido: par A)
Boceto de referencia: canvas "AGoals — Pantalla Hoy (claro y oscuro)" en claude.ai.
- **Pantalla Hoy:** la agenda es el centro (lista del día sin hora + planificación por horas 08-21 con línea de "ahora"). Columna lateral con los 3 próximos recordatorios y los 3 próximos eventos (los que haya; estado vacío "Aún no tienes recordatorios/eventos").
- Barra lateral: Hoy, Cofre, Calendario, Proyectos, Objetivos, Ideas. Botones "Recomendación" (secundario) y "Nueva tarea" (primario).
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
- Planificación por horas: un evento que cruza la medianoche estira el rango a 00:00 y deja una franja larga vacía; posible mejora futura: plegar las horas vacías.
- Etiquetas de prioridad: hoy se ven "Alta/Media/Baja"; el boceto decía "ALTA/MEDIA/BAJA" (cosmético).
- **Aviso de confirmación (pulido 1):** hoy es texto plano en la página (confirmaciones al guardar, concluir, cancelar, posponer, agendar…). Debe pasar a un aviso flotante pequeño en una esquina, con una animación corta de entrada y salida y que desaparezca solo, sin librería de toasts. Hay que conservar una región `aria-live` para los lectores de pantalla (y la propia dentro de los diálogos modales como el de Recomendación).
- Selector de hora del formulario: hoy es el input nativo y se ve feo; mejorarlo.
- Al posponer una tarea, su recordatorio pendiente no se mueve con ella (queda en la fecha original).
- Recomendación: el aviso de la página puede aparecer dentro del diálogo aunque venga de otra acción; el error de agendar persiste hasta el siguiente intento.
- Cofre: filtro de vínculo con búsqueda por nombre si la lista de proyectos crece.
