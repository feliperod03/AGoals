# AGoals: decisiones de diseño del frontend (rebanadas 8 y 9)

> Fijadas el 7/11/2026; actualizadas el 12/11/2026 (hecho hasta 5c, 8.3c y el Pulido 2a; ver el orden de rebanadas). Complementa a `agoals-brief.md`; si se contradicen, avisar.

## Stack
- Vite + React + **TypeScript (strict)**.
- TanStack Query (datos del servidor; polling de `/recordatorios/vencidos` con `refetchInterval`, hecho en 8.5a).
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
    ├── features/     agenda (incluye los recordatorios), cofre, recomendacion, jerarquia (compartido por proyectos y objetivos), proyectos, objetivos, ideas, calendario, eventos (diálogos de evento)
    ├── lib/          fechas.ts, texto.ts, utils
    └── types/        DTOs en TypeScript
```
Capas: componentes -> hooks de `features/` -> `api/`. Solo `api/` llama a `fetch`.

## Idioma
- Interfaz en español.
- Código: inglés para lo técnico/genérico (`Button`, `ApiClient`, `useDebounce`, `formatDate`); español para el dominio y lo que viene de la API (`Tarea`, `useTareasDelDia`, `marcarHecha`, `fechaHoraInicio`). Sin `ñ` en identificadores.

## Subtareas (8.2d `ceab9d9`; vincular 8.2g `c6afad8`; madre 8.2f `f195a8b`)
- **Agregar:** ítem "Agregar subtarea" en el menú de cada tarea abierta (Hoy y Cofre) y botón en el diálogo de edición. Abre «Agregar subtarea a «X»» con "Crear una nueva" (foco inicial; `padreId` fijado; aviso `mensajeSubtareaAgregada`; sin fecha va al Cofre y el aviso lo dice) y "Vincular una existente". Desde el diálogo de edición el de elección se abre encima; la edición solo se reemplaza al elegir "Crear una nueva" (se pierden los cambios sin guardar).
- **Vincular:** `BuscadorTareas` (título sin tildes ni mayúsculas, botones nativos, máx. 50 filas; lo comparte el selector de madre), una por vez. Candidatas (`candidatasSubtarea`): abiertas salvo la madre, sus ancestros y sus subtareas directas; si ya tiene otra madre la fila dice "Ahora es subtarea de «Z»; se moverá". Al elegir: PUT completo con el `padreId` nuevo (`requestConPadre`). Con la lista cargando o fallida solo "Vincular" se deshabilita; el error se ve en el diálogo (estado propio).
- **Cambiar la madre:** campo "Madre" solo en edición (`CampoMadre` + `SelectorMadre`, botón "Cambiar", "Sin madre" primero). Candidatas (`candidatasMadre`): abiertas más la madre actual, sin la propia ni sus descendientes. Sin tocar el campo el PUT reenvía el `padreId` original (`aRequest(valores, original, padreId)`: `undefined` = sin tocar, `null` = sin madre). Escape con la lista abierta cierra solo la lista. **Pendiente:** con el foco fuera del selector, Escape no hace nada mientras está abierta.

## Borrar con subtareas (5d `dc6c3c1`; 8.2e `be0913b`)
- **Backend:** `DELETE /api/tareas/{id}?subtareas=borrar|conservar` (204). Sin el parámetro y con subtareas: 409 con el título; valor inválido: 400. Todo en una transacción. `borrar` elimina la tarea y sus descendientes (recordatorios por cascada de la base); `conservar` reasigna y persiste (flush) las subtareas directas al padre de la tarea ANTES de borrar, porque `padre_id` tiene `ON DELETE CASCADE` (lo cubre un test contra Postgres real).
- **Frontend (`ConfirmarBorradoDialog`):** con subtareas dice "«X» tiene N subtareas" (todos los niveles, de `['tareas','todas']`, `descendientesDe` a prueba de ciclos) y ofrece "Conservar" (por defecto) o "Borrar también las subtareas" (destructiva). Mientras consulta confirmar está deshabilitado; si la lista falla cae al diálogo simple; un 409 refresca la lista. Invalida `['agenda']`, `['tareas']` y `['recordatorios']`.

## Posponer (8.2c; commit `2a78695`)
Sin cambios de backend (ya aceptaba `{fecha}`). `PosponerDialog` (montado una vez en `DialogosAcciones`; desde el menú o el diálogo de edición), solo para tareas abiertas con fecha (`puedePosponer`):
- **Mañana:** manda `hoy + 1`; solo si la fecha actual es anterior a mañana. **Elegir fecha:** `input type="date"` con mínimo = max(fecha + 1, hoy + 1). **Dejar sin fecha:** PUT con `fecha`, `horaInicio` y `horaFin` en null reenviando `estado` y `padreId` (`requestSinFecha`); no suma `veces_pospuesta`.
- Si falla, el diálogo queda abierto con el error; con una mutación en curso no se puede cerrar.

## Recomendación (8.3; commit `f2d0052`)
- Botón "Recomendación" en el encabezado de Hoy: diálogo con tareas abiertas sin fecha o atrasadas. Orden (Prioridad / Antigüedad) con botón de sentido en palabras; filtro Todos / Proyecto / Objetivo (búsqueda en el cliente, chip con "×"; uno a la vez).
- Filas: "Sin fecha" / "Atrasada desde <día>", chip de prioridad, proyecto u objetivo, subtareas anidadas de vista previa. Agendar: "Agendar «título» para hoy" y "Incluir N subtareas" (todos los niveles; marcado). Aviso "«X» agendada para hoy (con N subtareas)"; el diálogo sigue abierto. Región `role="status"` propia (Radix deja la página con `aria-hidden`).
- **Incluir próximos N días (5c backend `c3ff1dc` + 8.3c `7a3dd9e`):** interruptor (`role="switch"`) «Incluir próximos N días» con selector 7/14/30 (`aria-label="Cantidad de días"`); apagado por defecto, no se guarda, al encenderlo empieza en 7. `useRecomendacion` guarda `horizonte` y manda `hasta = hoy + N` (en la clave de la consulta; `undefined` si está apagado). El servidor añade al FINAL las abiertas con fecha en (hoy, hasta], por fecha, prioridad e id, ignorando orden/sentido; nunca anidadas como hijas. Una madre futura es raíz y lleva sus hijas sin fecha/atrasadas (lo mismo que mueve `PATCH /agendar`), así que «Incluir N subtareas» sale de `contarSubtareas` sin caso especial. Filas: «Para el <día corto>» con icono `CalendarClock` (`esFutura` en `lib/fechas.ts`). `hasta < fecha` da 400. Vacío: «No hay tareas para recomendar ni para los próximos N días.» El filtro «Futuras» del Cofre sigue existiendo. 1314 tests (85 archivos).

## Cofre (8.3b; commit `a33fcce`)
Inventario de **todas** las tareas, sin cambios de backend (`GET /api/tareas`; filtros, orden y anidado en el cliente; clave `['tareas','todas']`). Vista por defecto: abiertas sin fecha ("Volver a la vista por defecto" restablece todo).
- **Filtros (AND):** fecha (todas / con / sin / atrasadas / futuras / rango inclusivo; las sin fecha quedan fuera del rango), estado (abiertas por defecto), prioridad, vínculo directo (suelta / de un proyecto / de un objetivo; `<select>` nativos) y título (sin tildes ni mayúsculas).
- **Orden:** fecha (sin fecha al final), prioridad (alta primero) o antigüedad, con botón de sentido; al cambiar de orden el sentido vuelve al natural. Por defecto prioridad desc; desempate por id.
- **Accesos rápidos:** hasta 3, de una dimensión (Sin fecha, Con fecha, Atrasadas, Futuras, Prioridad alta/media, Sin prioridad, Pendientes, En progreso, Sueltas); pulsar uno reemplaza solo su dimensión y, si ya está activo, la devuelve a neutro (estado vuelve a "abiertas"). Por defecto: Sin fecha, Atrasadas, Prioridad alta. Se eligen en "Más filtros" y se guardan en `localStorage['agoals:cofre:anclados']` (try/catch y validación; los filtros no se persisten).
- **Subtareas anidadas:** una hija que cumple se anida bajo su madre si esta también cumple; si no, sube a raíz con "Subtarea de «madre»"; "+N subtareas ocultas por el filtro". A prueba de ciclos y padres inexistentes.
- **Acciones:** las de Hoy más "Agendar para hoy" en abiertas sin fecha, atrasadas o futuras (sin subtareas candidatas agenda directo; con candidatas abre un diálogo con "Incluir N subtareas"; `subtareasCandidatas` replica la regla del backend). "Nueva tarea" en el encabezado.
- **Chips de filtros activos (P1b; `4ff8cc8`):** `<ul aria-label="Filtros activos">` con un chip por dimensión fuera de su neutro sin acceso rápido encendido; "×" la devuelve a neutro (la búsqueda no genera chip). "Más filtros (N)" sin "(0)". Textos de vacío: "No hay tareas con estos filtros: …", "No hay tareas abiertas." y "No hay tareas sin fecha.". **Pendiente:** al quitar un chip el foco del teclado se pierde.

## Aviso flotante y color-scheme (P1a; commit `1642c9a`)
- `components/Aviso.tsx` reemplaza el texto plano de Hoy y Cofre: burbuja abajo a la derecha (abajo y centrada en pantallas angostas) con entrada y salida cortas (`motion-safe:`), se cierra sola (6 s, salida de 200 ms por temporizador, no por `transitionend`), con "×", y se pausa con el mouse o el foco. Un aviso nuevo reemplaza al anterior.
- La región `role="status"` es única por página y siempre está en el DOM; los diálogos conservan la suya (Radix deja la página con `aria-hidden`). Queda sobre el overlay (`z-[60]`); el "×" frena `pointerdown` para no cerrar el diálogo modal.
- `color-scheme: light` en `:root` y `dark` en `.dark` (`index.css`): íconos de fecha y hora, scroll y desplegables nativos se ven bien en modo oscuro.

## Proyectos y objetivos (8.4a `a388d07`; 8.4a2 `0655bf0`; 8.4a3 `9fd2703`)
Páginas `/proyectos`, `/proyectos/:id`, `/objetivos` y `/objetivos/:id`. Comparten `features/jerarquia/` (config por tipo `CONFIG_PROYECTO`/`CONFIG_OBJETIVO`, tipo estructural `ItemJerarquico`); `proyectos/` y `objetivos/` solo tienen los envoltorios y lo propio de cada uno. Sin cambios de backend ni dependencias.
- **Datos:** listado y detalle salen de la lista completa (`['proyectos']`, `['objetivos']`, las mismas claves del Cofre); el detalle no tiene consulta propia («no encontrado» = lista cargada sin ese id, o id no numérico). Toda mutación invalida las dos listas (`invalidarJerarquia`). El PUT reemplaza todo: siempre se reenvían los seis campos (`requestProyectoDe`/`requestObjetivoDe`), también en el cambio rápido de estado; sin `estado` el backend lo deja en PENDIENTE.
- **Listado:** árbol por `padreId` (a prueba de ciclos y padres inexistentes), filtro de estado (por defecto, abiertos), búsqueda sin tildes, orden fijo (prioridad y nombre). Un hijo que no cumple el filtro cuenta como «+N subproyectos ocultos por el filtro»; si el que no cumple es el padre, el hijo sube a raíz con «Subproyecto de «X»». El cambio rápido de estado no se propaga a hijos ni a padres; si el estado nuevo queda fuera del filtro, el aviso lo dice.
- **Crear/editar:** `ItemDialog` (react-hook-form) con «Padre» con búsqueda (no ofrece el propio ni sus descendientes; abiertos más el actual) y, en proyectos, `<select>` de objetivo (abiertos más el actual, que siempre figura aunque la lista falle). `EstadoItemDialog.iniciales` permite abrir la creación con valores prefijados.
- **Borrar (8.4a3):** `BorrarItemDialog` pide la vista previa de 5f (`useImpactoBorrado`, clave `['impacto-borrado', tipo, id, elecciones]` con raíz aparte, `staleTime` 0, sin reintentos, `keepPreviousData`) y muestra una fila por categoría con `total > 0`: radios «Mover / Borrar» (por defecto «Mover»), resumen en vivo con `borrados` («incluye subtareas…» si `borrados > total`) y aviso de proyectos rescatados. Confirmar solo se habilita con la respuesta de la elección actual (`isSuccess && !isPlaceholderData && !isFetching`) y manda un parámetro por fila visible (`parametrosDe`). Si la vista previa falla: «No se pudo calcular qué se borra» + «Reintentar», nunca un DELETE a ciegas. Tras borrar (`invalidarTrasBorrado`) se refrescan proyectos, objetivos, `['tareas']`, `['agenda']`, `['recordatorios']` e `['ideas']`, y el aviso añade lo demás que se borró (desde el detalle se vuelve a la lista con el aviso en el `state` del router). Lógica pura y textos en `jerarquia/borrado.ts`.
- **Detalle:** datos, padre, hijos directos y secciones propias. En el proyecto, las tareas ligadas (anidadas, de `useTodasLasTareas`). En el objetivo, sus proyectos y «Tareas ligadas directamente» (solo el vínculo directo; las de sus proyectos se ven en cada proyecto).
- **Vincular proyectos (8.4a2):** en el detalle del objetivo, «Agregar proyecto» (crear uno con el objetivo prefijado o vincular uno existente; si el candidato tiene otro objetivo, «Ahora es del objetivo «Y»; se moverá») y «Quitar» por proyecto (queda sin objetivo; no se borra); solo con el objetivo abierto. En el detalle del proyecto el objetivo se cambia o quita con un `<select>` en «Datos». Todo es un PUT del proyecto con los seis campos (`useCambiarObjetivo`).

## Vincular tareas a proyectos y objetivos (8.4b; commit `0417230`)
Solo frontend, sin dependencias nuevas. Contrato del backend (sin cambios): `PUT /api/proyectos/{id}/tareas/{tareaId}` y `PUT /api/objetivos/{id}/tareas/{tareaId}` (sin cuerpo, 200 con la `Tarea`) **reemplazan sin avisar** el vínculo anterior de ese tipo y no validan estados; los `DELETE` de los mismos paths dan 204 (404 si falta el proyecto/objetivo, 404 si falta la tarea, 400 «La tarea N no pertenece al proyecto M»). Una tarea puede tener proyecto y objetivo a la vez: son vínculos independientes. El PUT de edición de la tarea nunca manda `proyectoId`/`objetivoId` (un test lo fija).
- **`useVincularTarea`** (`features/jerarquia/`): una mutación (asignar o quitar) por instancia, con guard `useRef` liberado en `onSettled` (cubre también el refresco). Éxito: aviso e invalidación de `['agenda']` y `['tareas']`. Error: mensaje del servidor; en 400/404 se refrescan agenda y tareas y, solo en 404, la lista de su tipo. Con un error no se llama a `alExito`: el buscador sigue abierto con el mensaje.
- **`VincularTareaDialog`** («Proyecto y objetivo de «X»»): dos campos independientes (Cambiar / Quitar); cada cambio es una llamada inmediata (sin Guardar) y hay un solo buscador abierto a la vez; elegir el vínculo que ya tiene solo cierra el buscador. Si la lista de su tipo carga o falla, ese campo queda deshabilitado con una nota: nunca hay PUT/DELETE a ciegas. Las listas se piden con `useQuery` directo (mismas claves que `useListaJerarquia`) para no arrastrar `jerarquia/config.ts` a Hoy y al Cofre. Candidatos (`candidatosVinculo.ts`): abiertos más el vigente aunque esté cerrado.
- **Entradas:** ítem «Proyecto y objetivo…» del `MenuAcciones` (Hoy y Cofre, cualquier estado); botón en `TareaDialog` (abre ENCIMA de la edición; es la única vía para las tareas de la planificación por horas, que no tienen menú); y `TareasLigadas` en el detalle: «Quitar» por tarea ligada directamente y «Vincular una existente» (solo con el proyecto/objetivo abierto; si la tarea tiene otro, «se moverá»). Estado de apertura en `useAccionesTarea` (`pedirVinculo`, `vinculo`), montado una vez en `DialogosAcciones`.
- **Regla de capas:** `agenda/` importa de `jerarquia/` (`DialogosAcciones` → `VincularTareaDialog`) y `jerarquia/` ya importaba de `agenda/`. No hay ciclo mientras ningún archivo de `jerarquia/` importe `useAccionesTarea`, `DialogosAcciones`, `MenuAcciones` ni `TareaDialog`.
- **Fuera de alcance:** vínculo en las filas de Hoy, crear una tarea ya ligada (POST y PUT no atómicos), vínculo en el formulario de crear/editar y herencia del vínculo de la madre.

## Ideas (8.4c; commit `3548350`)
Página `/ideas`. Solo frontend, sin dependencias nuevas. Contrato (sin cambios): el PUT **reemplaza todo** (título, descripción, vínculo y conclusión) y no cambia el estado; `concluir` acepta `{conclusion}` opcional (vacío o ausente conserva la anterior; ya concluida = 409); `reabrir` es idempotente y conserva la conclusión; proyecto y objetivo a la vez = 400; borrar = 204 directo.
- **Datos:** `GET /api/ideas` completo, clave `['ideas']` (`useIdeas`); filtro y orden en el cliente, sin persistir (los filtros del backend no se usan). Los nombres del vínculo salen de `['proyectos']` y `['objetivos']` (con la lista sin cargar, «n.º N»).
- **Filtros (AND):** estado (Planteadas por defecto / Concluidas / Todas), vínculo (Todas / Sueltas / De un proyecto / De un objetivo, y un segundo `<select>` con «Cualquier…» o uno concreto; entran también los cerrados) y búsqueda sin tildes en título y descripción. El texto de vacío nombra los filtros activos. **Orden:** más recientes primero; una concluida se ordena por `fechaCierre` (si falta, por creación); en «Todas» se mezclan; desempate por id descendente.
- **Fila:** título, descripción, estado (texto e ícono), vínculo («Proyecto: X», «Objetivo: Y», «Suelta»), fechas y la conclusión entera. Menú: Editar, Concluir (solo planteadas), Reabrir (solo concluidas), Borrar.
- **`IdeaDialog`:** título obligatorio (recortado, ≤ 200), descripción y «Ligada a» (Ninguno / Proyecto / Objetivo con búsqueda). El vínculo vive como UN par `{tipo, id}` fuera del formulario, así que es imposible mandar proyecto y objetivo a la vez. **La conclusión solo se edita si la idea ya tiene una o está concluida** (una idea reabierta conserva la suya y viaja en el PUT). `aRequestIdea` manda SIEMPRE los cinco campos (un test fija el cuerpo). Si la lista del tipo vigente carga o falla, el campo queda quieto y se reenvía el vínculo original: nunca un vínculo a ciegas. `ConcluirIdeaDialog` (conclusión opcional; sin texto no se manda cuerpo), reabrir directo con aviso y `BorrarIdeaDialog` simple.
- **`useAccionesIdeas`:** cuatro mutaciones con UN guard `useRef` liberado en `onSettled`. Toda mutación invalida `['ideas']`; 404/409 refrescan `['ideas']` y un 400 al guardar refresca además proyectos y objetivos. `invalidarTrasBorrado` también invalida `['ideas']` (con la clave literal, para que `jerarquia/` no importe de `ideas/`).
- **Capas:** `ideas/` importa de `jerarquia/`, `agenda/` y `cofre/estilos`; ninguno de ellos importa de `ideas/`.
- **Pendiente conocido:** el PUT reemplaza todo y no hay versionado (editar desde una lista vieja puede pisar una conclusión escrita en otra pestaña; irrelevante con un solo usuario).

## Ideas ligadas en el detalle (8.4d; commit `8c447ca`)
Tarjeta «Ideas ligadas» de **solo lectura** en el detalle de proyectos y objetivos. Solo frontend, sin dependencias ni cambios de `api/`, `types/` o `PaginaDetalle`.
- **Qué muestra:** las ideas con vínculo DIRECTO a ese proyecto u objetivo (`ideasLigadas`; no las de los hijos ni las de los proyectos de un objetivo), planteadas y concluidas mezcladas, más recientes primero. Fila: título, estado (texto e ícono), «Creada el…» o «Cerrada el…» y la conclusión si la hay; sin menú ni botones (todo lo demás sigue siendo de `/ideas`). Límite de 5 (`LIMITE_IDEAS_LIGADAS`) con «+N más»; «Ver todas en Ideas» solo con al menos una; error de la lista dentro de la tarjeta (`ErrorEnLinea`).
- **Dónde vive:** `features/ideas/IdeasLigadas.tsx` + `ligadas.ts` (lógica pura y `rutaIdeasDe`); `ProyectoPage` y `ObjetivoPage` lo montan en `secciones`, así `jerarquia/` no importa de `ideas/`. Datos de `useIdeas` (`['ideas']`), sin consultas nuevas.
- **Enlace con filtro:** `/ideas?proyecto=N` o `?objetivo=N`; `IdeasPage` toma el estado inicial de `filtrosDesdeQuery` (ese vínculo y estado «Todas»; parámetros inválidos o ambos a la vez = vista por defecto). Solo se lee al montar, así que si ya estás en `/ideas` y llega otra URL sin desmontar la página el filtro no se actualiza (hoy no hay forma de llegar así desde la interfaz).

## Aviso de recordatorios vencidos (8.5a; commit `76719fd`)
Solo frontend, sin dependencias nuevas. Contrato (sin cambios): `GET /api/recordatorios/vencidos?ahora=` devuelve los no enviados con `fechaHora <= ahora` (por fecha e id, sin mirar el estado de la tarea) y `PATCH /api/recordatorios/{id}/marcar-enviado` (sin cuerpo, idempotente, 404 si no existe).
- **Dónde:** banner EN LÍNEA en el Layout (`<AvisoVencidos />` arriba del `<Outlet/>`), en todas las páginas; no usa el `Aviso` flotante de 6 s (se perdería si no estás mirando). Persistente: sigue hasta pulsar «Entendido» y sobrevive a recargar. Solo canal APP: avisa únicamente con la app abierta (sin scheduler ni notificaciones del navegador).
- **Cuándo se marca como enviado:** SOLO al pulsar «Entendido» (decisión de Felipe del 10/11; mostrarlo no lo marca).
- **Datos (`useRecordatoriosVencidos`):** clave `['recordatorios','vencidos']` SIN el instante; la `queryFn` llama a `ahora()` dentro, así cada petición manda la hora real. `refetchInterval` de 30 s (`INTERVALO_VENCIDOS_MS`), `refetchIntervalInBackground` false, `refetchOnWindowFocus` true solo en esta consulta, `staleTime` 0. Invalidar `['recordatorios']` la refresca por prefijo. Un fallo del polling no se muestra (TanStack conserva `data`).
- **Banner:** región `role="status"` `aria-live="polite"` siempre en el DOM aunque esté vacía (una región que aparece junto con su contenido no se anuncia). Una fila por recordatorio: texto (descripción o, si no hay, el título de la tarea/evento con `useTituloRecordatorio`), «Para el <fecha y hora corta>» y «Entendido». Máximo 5 filas (`MAX_VENCIDOS_VISIBLES`) y «+N más pendientes».
- **«Entendido» (`useMarcarEnviado`):** una mutación a la vez (guard `useRef`); el éxito espera `invalidateQueries(['recordatorios'])`, así el guard sigue tomado hasta que la fila ya no está. Un error queda bajo esa fila; con 404 se refresca y la fila se va.
- **Tareas cerradas:** un vencido de una tarea hecha o cancelada por otro camino se muestra igual (limitación documentada en `modelo-datos.md`).
- **Capas:** todo en `features/agenda/`; `app/Layout.tsx` importa de `agenda/`, nunca al revés. Lo nuevo de recordatorios no debe vivir en una carpeta que importe de `agenda/` (ciclo).

## Recordatorios: crear, editar y borrar (8.5b; commit `2780858`)
Solo frontend, sin dependencias nuevas. Contrato (sin cambios): `POST` y `PUT /api/recordatorios` (reemplazo completo: `tareaId`, `eventoId`, `fechaHora`, `canal`, `descripcion`), solo canal APP, máximo uno por tarea o evento (409), suelto con descripción obligatoria, 404 si ya no existe; si cambia el instante de `fechaHora`, `enviado` vuelve a false.
- **Un solo `RecordatorioDialog`** con la prop `destino`: `tarea`, `evento` (9d), `suelto` y `existente` (edición de una fila). Se monta solo mientras está abierto y no se cierra con una mutación en curso. Estado local, sin react-hook-form (son dos campos).
- **Modo tarea** (el de evento es igual, ver 9d): se consulta el recordatorio (`useRecordatorioDeTarea`, clave `['recordatorios',{tareaId}]`, la misma de 8.2b; `cargando` incluye los refrescos). Mientras carga o si falla («Reintentar») los campos y botones quedan deshabilitados: nunca se escribe a ciegas. Sin recordatorio: «Crear recordatorio»; con uno: «Guardar cambios» y «Quitar recordatorio» (inmediato, sin confirmar, como pidió Felipe). Cada acción es una llamada inmediata y el diálogo queda abierto (se cierra con «Listo»); el formulario se reinicia con `key` según el id, así que tras un 409 al crear pasa a editar solo y tras un 404 vuelve a crear. Puede abrirse encima de la edición de la tarea.
- **Modo suelto y existente:** se cierra al guardar o borrar; borrar desde una fila pide confirmación dentro del mismo diálogo. La descripción es obligatoria (recortada) solo si no hay `tareaId` ni `eventoId`; el PUT conserva `tareaId`, `eventoId` y `canal` tal cual. Sin `maxLength` (el backend no define límite).
- **Valores por defecto (`recordatorioForm.ts`):** tarea con `horaInicio` → esa fecha y hora; solo fecha → ese día a las 09:00 (`HORA_POR_DEFECTO`); sin fecha, y todo suelto → mañana a las 09:00. Si el instante ya pasó: nota «Esa hora ya pasó: el aviso saldrá enseguida.», sin bloquear.
- **`useAccionesRecordatorio`:** una mutación (`crear|actualizar|borrar`) con guard `useRef` liberado en `onSettled`; el éxito espera `invalidateQueries(['recordatorios'])` (banner, Próximos y consultas por tarea o evento); 404 y 409 refrescan y dejan el mensaje del servidor. En `lib/fechas.ts`: `aValorDatetimeLocal`, `deValorDatetimeLocal` (null si es inválido: nunca un `Invalid Date`) y los `mensajeRecordatorio…`.
- **Dónde se abre (tareas):** ítem «Recordatorio…» del menú y botón en `TareaDialog`, solo en tareas **abiertas** (reusa `puedeAgregarSubtarea`). En la tarjeta «Próximos recordatorios» de Hoy: «Nuevo recordatorio» y «Editar» por fila (la tarjeta muestra solo los 3 siguientes sin enviar: un vencido o el cuarto no se edita desde ahí).
- **Capas:** todo en `features/agenda/`; sin imports de `app/`, `jerarquia/` ni `ideas/`.

## Mover el recordatorio al posponer (8.5c; commit `e7aa911`)
Solo frontend, sin dependencias nuevas ni backend.
- **`PosponerDialog`** consulta el recordatorio (`useRecordatorioDeTarea`, solo con el selector abierto; los botones esperan mientras carga, «Cancelar» no). Hay algo que mover si existe, tiene `enviado=false` y la tarea tiene fecha; si no, no hay casilla. Si la consulta falla: nota «No se pudo consultar el recordatorio de esta tarea: si tiene uno, no se moverá» y se pospone sin mover.
- **Casilla «Mover también el recordatorio (cae el …)»**, marcada por defecto, para «Mañana» y «Elegir fecha». La ayuda muestra el instante nuevo de cada destino («Con Mañana: …», «Con la fecha elegida: …») y «Seguirá vencido: el aviso saldrá enseguida.» si aun movido queda en el pasado (se mueve igual: una sola regla). Desmarcada: «El recordatorio se queda donde está.». «Dejar sin fecha» nunca lo mueve: la ayuda y el aviso (`mensajeSinFechaConRecordatorio`) lo dicen.
- **Cómputo (`lib/fechas.ts`):** `diasEntre` (días de calendario entre la fecha de la tarea y la que confirmó el backend) y `moverInstanteDias` (`addDays` sobre un `Date` local: conserva la hora de pared aunque cambie el horario). Un aviso puesto un día antes de la tarea sigue un día antes.
- **Hook (`useAccionesTarea`):** `ejecutar(tipo, tarea, fecha?, recordatorio?)`. En `'posponer'`: PATCH y luego PUT con los cinco campos (`requestMovido`, en `recordatorioForm.ts`); `ejecutarAccion` ignora un recordatorio ya enviado. Si el PUT falla (404/409/500) no se relanza: la tarea queda pospuesta, el selector se cierra y el aviso lleva el mensaje del servidor (`mensajeRecordatorioNoMovido`). Éxito: `mensajeRecordatorioMovido`. Si se pasó un recordatorio se invalida `['recordatorios']`. En `'sinFecha'` solo cambia el texto del aviso. Un guard `useRef` (`enCurso`) protege a todas las acciones del doble clic.

## Calendario mensual (9a; commit `26c36bd`)
Solo frontend, sin dependencias nuevas ni backend. Grilla propia con date-fns (decidido: sin librería; a igual usabilidad, lo más estético). Ruta `/calendario`, todo en `features/calendario/`.
- **Datos:** eventos con `useEventosEnRango` (`['eventos','rango',desde,hasta]`, rango de la cuadrícula, `keepPreviousData`; «Cargando…» sale de `isFetching`); tareas de `['tareas','todas']` filtradas por fecha en el cliente (CANCELADO oculto, HECHO atenuado). Cada fuente falla por separado.
- **Lógica pura (`calendario.ts`):** `elementosPorDia` (un tramo por cada día que toca un evento: `tramoDelEventoEnDia`), orden (con hora por minuto de inicio y el evento antes que la tarea; sin hora por prioridad e id), `recortarParaCelda` (3 líneas; con más, 2 + «+N más»), `textoHora` («desde 22:00», «hasta 06:00», «Todo el día», «22:00–00:00»), `etiquetaDia`, `estadoDesdeUrl`, `diaDestino` (teclado). En `lib/fechas.ts`: `semanasDelMes` (lunes a domingo), `limitesDeSemana`, `sumarMeses`, `moverMesConservandoDia`, `parsearMes`, `esFechaValida`.
- **URL:** `?mes=YYYY-MM&dia=YYYY-MM-DD`, derivados en el render (inválido = valor por defecto, sin reescribir la URL). Lo que cambia el mes hace push; cambiar solo el día dentro de la cuadrícula hace replace.
- **Clic en un día:** lo selecciona y el panel «Detalle del día» (solo lectura: hora, estado, prioridad, «Atrasada») muestra todo lo suyo; desde 2a baja hasta el panel si queda debajo. No navega a Hoy porque `HoyPage` no admite otra fecha (ver 9f).
- **Accesibilidad:** `role="grid"` con roving tabindex; cada día es un botón con `aria-label` («martes 10 de noviembre, hoy, 2 eventos, 3 tareas»); flechas ±1 / ±7, Inicio/Fin, RePág/AvPág. El panel es un `aside` con nombre.
- **Aspecto:** una sola tarjeta, números en Fraunces, hoy en círculo `acc`, seleccionado con anillo y fondo `--sel`; evento = rectángulo, tarea = píldora con el círculo de estado.
- **Responsive (container queries sobre la cuadrícula):** < 640 px marcas sin texto; 640–980 chips solo con título; ≥ 980 chips con hora. El panel va al lado solo con ≥ 1224 px de contenido (~1560 px de ventana); debajo ocupa todo el ancho. Felipe usa ventanas de ≤ 1280 px: cuadrícula de 945 px, chips de solo título y panel debajo.
- **Capas:** `calendario/` importa de `agenda/` (`horario`, `useAhora`, `useTodasLasTareas`, `EstadoIcono`); ningún archivo de `agenda/`, `jerarquia/`, `cofre/` ni `ideas/` importa de `calendario/`. Solo `useEventosEnRango` toca `@/api`.
- **Fuera de alcance:** vista anual y barras continuas para eventos largos.

## Calendario semanal (9b; commit `7f10dce`)
Solo frontend, sin dependencias nuevas ni backend. Mismo `/calendario`. `lib/fechas.ts` suma `diasDeLaSemana`, `formatearRangoSemana`, `duracionEnMinutos` y `formatearDiaCorto`; `distribuirSolapes` (`agenda/horario.ts`) pasó a ser genérica (Hoy no cambia).
- **URL:** el mes sigue igual (`?mes=&dia=`); la semana es `?vista=semana&dia=YYYY-MM-DD` (`dia` inválido o ausente = hoy; `vista` desconocida = mes). El selector «Mes | Semana» hace push y lleva el día elegido en los dos sentidos; ‹ ›, «Hoy» y el teclado que sale de la semana hacen push, mover el día dentro hace replace. «Hoy» hace replace si la URL no cambia (`mismaBusqueda`), lo que también arregla el apilado de historial en el mes.
- **Datos:** un solo `useEventosEnRango` con el rango de la vista y el `elementosPorDia` de 9a. `repartirDia`: a la franja «Sin hora» van las tareas sin hora y los eventos de 24 h o más; el resto, a la línea de tiempo, cortado en la medianoche. Un tramo 00:00–24:00 de un día se lee «Todo el día».
- **Grilla (≥ 560 px de contenido):** eje de 56 px; encabezado de días `sticky`; franja «Sin hora» de alto común (24 px por elemento); rango = unión de la semana (08–21 o más) a 48 px por hora; línea de ahora solo en hoy. Bloques con container query (altos ≥ 40 px: hora arriba desde 56 px de ancho interior; cortos: hora delante desde 100 px). Evento = rectángulo (recto donde lo corta la medianoche), tarea = píldora con círculo de estado.
- **Accesibilidad:** cada día es un `role="group"` (no `grid`) con `etiquetaDia`; solo los 7 encabezados son controles, con roving tabindex (← →, Inicio/Fin, RePág/AvPág). Desde 9c los bloques de evento son botones. Sin panel de detalle en la semana.
- **< 560 px:** `ListaSemana` (7 secciones con `FilaDetalle` de 9a). Las dos variantes están en el DOM y una se oculta por container query (los tests usan `within`).

## Eventos: crear, editar y borrar (9c; commit `ffa1562`)
Solo frontend, sin dependencias nuevas ni backend. Carpeta nueva `features/eventos/` (`formularioEvento.ts`, `useAccionesEvento.ts`, `EventoDialog`, `BorrarEventoDialog`, `DialogosEvento`); `calendario/` importa de `eventos/`, nunca al revés. `agenda/useRecordatorioDeEvento.ts` (`['recordatorios',{eventoId}]`, `staleTime 0`, `refetchOnMount 'always'`) lo reusa 9d. API: `crearEvento`, `actualizarEvento`, `borrarEvento`, `getRecordatoriosDeEvento`. `lib/fechas.ts` suma `partesLocales`, `deFechaYHoraLocal`, `minutosEntre`, `sumarMinutos`, `esDeDiasCompletos`, `formatearRangoEvento`, `esHoraValida` y los `mensajeEvento…`.
- **Formulario:** título (≤ 200, con trim), fecha y hora en inputs separados y casilla «Todo el día» (guarda 00:00 del primer día a 00:00 del día siguiente al último). Al mover el inicio el fin lo sigue conservando la duración. Errores: fin > inicio, último día ≥ primero; título y fechas se ven a la vez (H2). El PUT siempre manda los 5 campos (`titulo, descripcion, fechaHoraInicio, fechaHoraFin, prioridad`). Al desmarcar «Todo el día» vuelven las horas previas (si el fin queda ≤ inicio, dura 1 h).
- **Entradas:** «Nuevo evento» en el encabezado del calendario (usa el día elegido: hoy → próxima hora en punto, 1 h, y 23:xx → 23:00–00:00; otro día → 09:00–10:00) y «Agregar evento» al pie de «Detalle del día». Filas del panel, bloques de la semana y chips de la franja son botones de edición: `<button class="absolute inset-0">` hermano vacío con `aria-label` «Editar evento: …» (nunca un div dentro de un botón).
- **Atajos de mouse (P2, P9):** chip del mes (solo la variante ancha ≥ 640 px lleva `data-evento-id`): `CeldaDia.onClick` selecciona el día y abre el evento si el clic cae en un chip; en < 640 px solo selecciona. Clic en un hueco de la semana: `horaDesdePosicion` redondea hacia abajo a 30 min acotado a `[inicio, fin − 30]`, evento de 1 h; en la franja «Sin hora» abre «Todo el día». `esClicEnHueco` ignora `button, [data-bloque], [data-evento-id]` (la línea de «ahora» es un bloque, H1). Solo mouse (sin role ni tabIndex): el equivalente accesible es «Nuevo evento». `ListaSemana` (< 560 px) no tiene clic en hueco.
- **Borrar:** la confirmación se abre encima de la edición, consulta el recordatorio del evento (si la consulta falla igual deja borrar, P5), foco inicial en Cancelar. Un 404 al borrar cierra con «El evento «X» ya no existía» (P6); al guardar muestra el mensaje real del servidor.
- **Mutaciones:** un `useRef` anti doble envío liberado en `onSettled`; el diálogo se cierra DESPUÉS de `await invalidateQueries` (`['eventos']`; borrar también `['recordatorios']`). Tras crear, el calendario va al día del evento (replace si ya es visible, push si no); editar no navega (P8).
- **Foco al cerrar (hallazgo):** como los diálogos de la app son controlados (sin `DialogTrigger`), Radix no devuelve el foco: se hace a mano (disparador, o «Nuevo evento» por ref, vía `onCloseAutoFocus`). Pasa en toda la app; pendiente en los demás diálogos.
- **Decisiones:** P3 «Hoy» solo refresca; P4 las tareas no son clicables; P7 (mover el recordatorio al mover el evento): hecho en 9e `d949a6b` (conserva la distancia al inicio).
- **Pruebas manuales:** 21 casos OK (`.playwright-mcp/informe-9c.md`; hover sin cambios de tamaño).

## Recordatorios de evento (9d; commit `1da4b2e`)
Solo frontend, sin dependencias nuevas ni backend. Reusa el `RecordatorioDialog` de 8.5b con el destino `{ tipo: 'evento', evento }`, que lleva el evento GUARDADO (no lo escrito en el formulario).
- **Una sola entrada:** botón «Recordatorio…» en las acciones de `EventoDialog`, solo en edición (cubre fila, bloque y chips, que abren la edición). Se abre ENCIMA, así que el formulario no se desmonta y lo escrito se conserva. Crear un evento no lo ofrece. La etiqueta es «Recordatorio…» o «Recordatorio: <fecha y hora corta>»: la edición consulta el recordatorio (`useRecordatorioDeEvento`) con un envoltorio, porque el hook no puede llamarse condicionalmente; mientras la consulta carga o falla, el botón sigue habilitado. Tamaño por defecto (40 px; `max-sm:h-11` = 44 px y ancho completo en móvil), nunca `sm`.
- **Componente compartido:** `ContenidoTarea` y `ContenidoEvento` son envoltorios de ~8 líneas (cada uno llama a su hook) sobre `ContenidoConsultado`; los textos que cambian están en la tabla `TEXTOS`, y `ConsultaRecordatorio` (en `recordatorioForm.ts`) es el tipo común de los dos hooks. El diálogo acepta `alCerrarFoco`: el foco vuelve a mano al botón «Recordatorio…» (`disparadorRecordatorio`). El estado de apertura está en `useAccionesEvento` (`recordatorioDe`, `pedirRecordatorio`, `cerrarRecordatorio`; expone `alMensaje`) y el diálogo se monta en `DialogosEvento`. Escape cierra solo el de arriba.
- **Hora por defecto** (`valorInicialEvento`): con hora, `MINUTOS_AVISO_EVENTO` = 60 minutos antes del inicio (puede caer el día anterior); de días completos, su primer día a las 09:00. La constante vive solo en `recordatorioForm.ts`. Bajo la descripción, `mensajeEventoEmpieza`: «El evento empieza el <fecha y hora corta>» o, de días completos, «El evento es <lapso>» (porque «00:00» confunde).
- **Capas:** `eventos/` importa de `agenda/`; ningún archivo de `agenda/` importa de `eventos/` ni de `calendario/` (`RecordatorioDialog` solo usa el tipo `Evento`).
- **Mover el recordatorio al mover el evento:** ver 9e (abajo).
- **Pruebas manuales:** 12 casos OK (`.playwright-mcp/informe-9d.md`): hora por defecto, día completo, quitar, 409, 404, consulta fallida, doble clic, lo escrito sobrevive, foco con teclado, 390 px y borrado con cascada.

## Mover el recordatorio al mover el evento (9e; commit `d949a6b`)
Solo frontend, sin dependencias nuevas ni backend. Modelo: 8.5c (`PosponerDialog`).
- **Cuándo se ofrece:** al guardar un evento en edición cuyo INICIO cambió (se comparan instantes con `getTime()`, no textos; si solo cambia el fin, no) y que tiene un recordatorio con `enviado = false`. Con uno ya enviado no hay casilla (se edita a mano desde «Recordatorio…»).
- **Casilla** «Mover también el recordatorio (cae el <actual>)», marcada por defecto, entre «Fin» y «Recordatorio…». Ayuda: «Quedará el <instante>.» (+ «Seguirá vencido: el aviso saldrá enseguida.» si ya pasó; se mueve igual) o, desmarcada, «El recordatorio se queda donde está.». Si se desmarca, se respeta aunque la casilla se oculte y vuelva a aparecer (D2). Con «Todo el día» el instante se recalcula antes de guardar.
- **Qué se conserva:** la DISTANCIA al inicio. `instanteMovido(recordatorio, inicioViejo, inicioNuevo)` (`eventos/moverRecordatorio.ts`) = recordatorio + (inicio nuevo − inicio viejo) en minutos; `null` si ya fue enviado, el instante no cambió o hay datos inválidos. Los segundos del recordatorio se descartan (desde la UI son `:00`). `inicioIso(valores)` (`formularioEvento.ts`) es la única definición del inicio: lo que muestra la casilla es lo que se manda.
- **Guardar:** `guardar(request, recordatorio?)` en `useAccionesEvento`: PUT del evento y DESPUÉS PUT del recordatorio con los cinco campos (`requestMovido`, el mismo de 8.5c); si el segundo falla, el evento queda guardado, el diálogo se cierra y el aviso lleva el mensaje del servidor, sin reintento. El guard `enCurso` cubre las dos llamadas (doble clic = un PUT de cada uno). Invalida `['eventos']` siempre y `['recordatorios']` solo si intentó mover. Mensajes en `lib/fechas.ts`: `mensajeEventoGuardadoConRecordatorio` y `mensajeEventoRecordatorioNoMovido`.
- **Consulta del recordatorio** (la misma de «Recordatorio…»): `Guardar` espera solo si el inicio cambió y la consulta está cargando. Si falla (incluso con datos viejos), se guarda el evento sin mover y el diálogo lo avisa antes con `notaRecordatorioEventoNoConsultado` (D1); nunca se escribe a ciegas.
- **Recordatorio creado desde el diálogo con un inicio escrito sin guardar:** se crea con el inicio GUARDADO; al volver, la casilla aparece marcada con el instante coherente respecto del inicio nuevo.
- **Pruebas manuales:** casos 9–13 y el extra OK, más consulta fallida, `Guardar` en espera, doble clic y 390 px (`.playwright-mcp/informe-9e.md`). Tests: 1296 de frontend al cerrar 9e (85 archivos); lint y build limpios.

## Pulido 2a: aspecto y tema (commit `eed9465`)
Solo frontend, sin dependencias nuevas ni backend. 1358 tests (88 archivos); lint y build limpios.
- **Tema manual:** `app/tema.ts` (puro: `leerPreferencia`, `guardarPreferencia`, `esOscuro`, `siguientePreferencia`) y `app/useTema.ts` (`{ preferencia, ciclar }`; solo escucha `prefers-color-scheme` mientras la preferencia es `sistema`). Clave `localStorage['agoals:tema']` = `claro` | `oscuro`; ausente, inválida o sin acceso al almacenamiento = sistema. `BotonTema` en `Layout.tsx`, junto al logo: cicla Sistema → Claro → Oscuro con texto visible, icono y `aria-label` «Tema: X. Cambiar a Y» (44 px en móvil); el hook pasó de `App.tsx` a `Layout.tsx`. **Sin parpadeo:** script inline en `index.html` con la misma lógica; `tema.test.ts` lo extrae, lo ejecuta en jsdom y lo compara con `esOscuro` (si cambia una, cambia la otra).
- **Hover de filas:** `hover:bg-muted` cubre la fila entera (círculo, título y menú) en Cofre y Hoy con `-mx-2 px-2` en el contenedor, sin mover nada. No se usó `-mx-3` en el botón: se habría superpuesto a los botones vecinos.
- **Proyectos y objetivos:** la fila hace `flex-wrap` (el nombre pide `basis-56`) y en pantallas angostas el estado y el menú pasan a una segunda línea. `Tarjeta` acepta `titulo` opcional y `ariaLabel`; `PaginaLista` ya no dibuja el h2 duplicado (queda el h1).
- **Calendario:** token `--sel` (opaco; claro `#ece2ce`, oscuro `#141d30`) en la celda del mes, la columna de la semana y su encabezado sticky; elegido por capturas: `#1f2d46` hacía desaparecer la píldora de tarea y `--card` no distinguía la columna. `DetalleDia` conserva `hover:bg-side` (el hover oscuro es convención de la app). Tras un clic de mouse (`event.detail > 0`) en un día del mes, `scrollIntoView({ block: 'nearest' })` lleva al panel «Detalle del día» si queda debajo (`auto` con `prefers-reduced-motion`); no con teclado ni al abrir un evento; espera a que el panel muestre el día nuevo.
- **Hora:** `formatearHoraDelDia` (`lib/fechas.ts`, 1440 → `00:00`) la usan el calendario y Hoy: «EVENTO · 22:00–00:00» y el eje de Hoy sin «24:00». `formatearMinutos(1440)` sigue dando `24:00`.
- **Táctil (H5):** `max-sm:h-11` en 11 botones: «Agregar evento», «Nuevo recordatorio», «Editar» de recordatorio, «Agendar … para hoy» y 7 de `RecordatorioDialog`. El resto de los `sm` queda para la fase móvil.
- **Medido y no tocado:** el salto de la semana entre 768 y 894 px viene de que la barra lateral (240 px, desde `md`) quita ~287 px de ancho útil de golpe y la grilla necesita 560 px de contenido (~894 px de ventana); un umbral no lo arregla (columnas de ~56 px). Lo limpio es mover el quiebre de la barra de `md` a `lg`, que cambia toda la app: Futuro.
- **Entorno y pruebas:** tras añadir un token al `@theme`, Vite no generó `bg-sel` hasta tocar (`touch`) `index.css`; no hizo falta reiniciarlo. Pruebas manuales OK a 1280 y 390 px, claro y oscuro (`.playwright-mcp/informe-p2a.md`); la animación suave del scroll no se pudo observar en el Chromium de Playwright (solo la opción pasada, comprobada en tests).

## Orden de rebanadas
- 8.0 Esqueleto: hecha (commit `07c1c25`).
- 8.1 Agenda del día en lectura (tareas + eventos, lista del día y horas, próximos recordatorios y eventos): hecha (commit `e9ba44d`).
- 8.2a Crear y editar tareas, hecha (diálogo con formulario; fecha vacía -> cofre; revisar el riesgo del `PUT` antes de editar).
- 8.2b Acciones rápidas (hecha, reabrir, posponer, cancelar, reactivar, borrar; pregunta por el recordatorio pendiente al cerrar): hecha.
- 8.3 Recomendación, hecha (commit `f2d0052`).
- 8.2c Posponer con opciones (mañana / elegir fecha / dejar sin fecha), solo frontend: hecha (commit `2a78695`).
- Refactor previo al cofre: hecho (commit `1e3256f`).
- 8.3b Cofre, hecha (commit `a33fcce`).
- 8.2d Crear subtareas, solo frontend: hecha (commit `ceab9d9`).
- 5d Borrar tarea con subtareas (backend): hecha (commit `dc6c3c1`).
- 8.2e Diálogo de borrado con opciones: hecha (commit `be0913b`).
- 8.2f Cambiar o quitar la madre de una tarea: hecha (commit `f195a8b`).
- 8.2g Vincular una tarea existente como subtarea: hecha (commit `c6afad8`).
- P1 Pulido 1: hecho (P1a `1642c9a`: aviso flotante, `color-scheme`, aviso de subtarea sin fecha; P1b `4ff8cc8`: chips de filtros activos).
- 8.4a Páginas de Proyectos y Objetivos: hecha (commit `a388d07`).
- 8.4a2 Vincular proyectos a un objetivo desde su detalle: hecha (commit `0655bf0`).
- 5e (backend) Borrar proyectos y objetivos eligiendo qué hacer con cada categoría (`borrar|conservar`, 409 con el nombre): hecha (commit `f17aa98`; semántica en el brief).
- 5f (backend) Vista previa del impacto del borrado (`GET …/impacto-borrado`): hecha (commit `43ecec5`; contrato en el brief).
- 8.4a3 Diálogo de borrado con un interruptor «Mover / Borrar» por categoría: hecha (commit `9fd2703`).
- 8.4b Asignar y quitar el proyecto u objetivo de una tarea: hecha (commit `0417230`). 635 tests.
- 8.4c Página de Ideas: hecha (commit `3548350`). 735 tests.
- 8.4d Ideas ligadas en el detalle de proyectos y objetivos: hecha (commit `8c447ca`). 764 tests.
- 8.5a Aviso de recordatorios vencidos (banner en el Layout): hecha (commit `76719fd`). 782 tests.
- 8.5b Crear, editar y borrar recordatorios: hecha (commit `2780858`). 824 tests.
- 8.5c Mover el recordatorio al posponer: hecha (commit `e7aa911`). 857 tests.
- 9a Calendario mensual en lectura: hecha (commit `26c36bd`). 980 tests.
- 9b Vista semanal en lectura: hecha (commit `7f10dce`). 1046 tests.
- 9c CRUD de eventos: hecha (commit `ffa1562`). 1221 tests al terminar la implementación (más los de H1 y H2).
- 9d Recordatorios de evento (botón «Recordatorio…» en la edición del evento; aviso 60 min antes por defecto): hecha (commit `1da4b2e`).
- 9e Mover el recordatorio al mover el evento (P7; casilla marcada por defecto, conserva la distancia al inicio, fallo parcial sin reintento): hecha (commit `d949a6b`). Con ella queda completa la fase 9.
- 5c (backend) + 8.3c: tareas futuras en la recomendación: hecha (commits `c3ff1dc` y `7a3dd9e`). 1314 tests de frontend.
- Pulido 2a Aspecto y tema: hecha (commit `eed9465`). 1358 tests de frontend (88 archivos).
- Pulido 2b Foco, avisos y errores ← próxima; 2c Limpieza técnica; después, opcional, 9f Vista de día (ver «Pulido 2» abajo).

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
| sel (día seleccionado en el calendario; 2a) | #ECE2CE | #141D30 |
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

## Pulido 2 (plan acordado el 12/11: tres fases y la vista de día aparte; un commit por fase)
- **2a Aspecto y tema: hecha** (`eed9465`; ver su sección).
- **2b Foco, avisos y errores** (solo frontend; plan con `/model opusplan`; ← próxima):
  - Foco y teclado: foco al quitar un chip del Cofre; Escape con el foco fuera del selector de madre; devolver el foco al cerrar los demás diálogos (hoy solo lo hacen los de eventos y el de recordatorio de evento; idealmente un cambio único en el wrapper del Dialog).
  - Errores: `acciones.error` compartido (un error al posponer se ve en el selector y en el cartel de la lista; cancelar el selector no lo limpia); el error de «Reabrir» y el de agendar persisten hasta el siguiente intento; el aviso de la recomendación puede aparecer dentro del diálogo aunque venga de otra acción; en el diálogo de borrado de proyectos/objetivos el error de un DELETE fallido sigue visible si se cambia un interruptor; tras un 404 al editar una fila de recordatorio ofrecer una salida clara.
  - Fallos parciales: aviso persistente cuando la tarea o el evento quedó guardado pero no se movió el recordatorio (8.5c y 9e; hoy dura 6 s).
  - Textos que explican el porqué: el recordatorio ya fue enviado (diálogo de tarea, 8.5b; en el de evento, 9e, no hay casilla y no se dice por qué); ayuda vacía de la casilla de 8.5c si no hay destino calculable.
  - Lectores de pantalla (lo primero en recortarse: si el plan estima más de ~10 archivos, pasa a Futuro): los avisos de los diálogos de vincular (8.4b), ideas (8.4c), recordatorio (8.5b) y eventos (9c) no llegan (la región `status` de la página queda `aria-hidden` bajo el diálogo); el banner de vencidos (8.5a) también queda `aria-hidden` bajo un diálogo; `EstadoIcono` deja un espacio antes de la coma en el texto del lector.
- **2c Limpieza técnica** (frontend y un comentario en backend; Sonnet):
  - `esCerrada` duplicado en `TareasLigadas` (existe `esAbierto` en `jerarquia/tipos.ts`); `BuscadorTareas` como adaptador de `BuscadorLista`; guarda de `SelectorObjetivo` para un id fuera de las opciones; `Campo` duplicado por tercera vez.
  - Unificar la consulta directa de `['proyectos']`/`['objetivos']` (hoy en `VincularTareaDialog`, `TareasLigadas` y `useListaJerarquia`) SIN importar `useListaJerarquia` desde Hoy ni el Cofre (8.4b lo evitó para no arrastrar `jerarquia/config.ts`): extraer un hook mínimo y neutral.
  - `todosComoCandidatos` (`ideas/filtros.ts`) es código muerto; mover `test/renderIdeas.tsx` junto a su página; renombrar `puedeAgregarSubtarea` (es el criterio de «tarea abierta»); el test del 404 de «Entendido» no comprueba el mensaje; línea en blanco doble en `calendario.ts` donde estaba `horaDeMinutos`.
  - H3: tras borrar un evento sobra un `GET /api/recordatorios?eventoId=N` (cerrar la confirmación antes de esperar `['recordatorios']`); comentario viejo en `EventoService.eliminar` (backend, solo comentario).
- **9f Vista de día** (rebanada aparte, después de 2c; plan con opusplan): vista de cualquier fecha, con tareas y horas como Hoy (idea de Felipe, P4 de 9c). `/api/tareas/agenda` ya recibe la fecha del cliente (`['agenda', fecha]`); hay que decidir cómo hace `HoyPage`, que asume «hoy» (línea de ahora, «Agendar para hoy», próximos), para aceptar otra fecha y cómo se llega desde el calendario.
- **A Futuro:**
  - Mover el quiebre de la barra lateral de `md` a `lg` en `Layout.tsx` (arregla el salto de la semana entre 768 y 894 px; cambia toda la app).
  - Fase móvil: botón «Cerrar» (X) de los diálogos (36 px) y el resto de los `sm` y de 40 px a 44 px en táctil (~30: `AvisoVencidos`, `TareaDialog`, `PanelFiltros`, `FiltrosIdeas`, `FiltrosLista`, «Invertir el sentido», cabeceras `default`…), mejor con un cambio central en `button.tsx`.
  - Plegar horas vacías en Hoy y en la semana (un evento nocturno estira el rango a 00–24).
  - Mostrar el proyecto/objetivo en las filas de Hoy (8.4b lo dejó fuera); filtro de vínculo del Cofre con búsqueda si la lista de proyectos crece.
  - Subir la base de la cuadrícula del calendario de 900 a 980 px solo si se usa una pantalla grande.
- **Descartado (12/11):** selector de hora propio (el input nativo con `color-scheme` basta; uno propio sería una dependencia o un componente grande con riesgo de accesibilidad); tarjeta de objetivos con % de progreso (fuera de la v1, exige un endpoint); hora del aviso parametrizable (sin login no hay «por usuario» y «por recordatorio» ya se edita a mano); crear un evento con su recordatorio en un paso (9d decidió que crear no lo ofrece; serían dos llamadas no atómicas); campana de recordatorio en el calendario; el literal «N» del interruptor de 8.3c (decisión de la rebanada); la tarjeta «Próximos» limitada a 3 (diseño intencional; los vencidos se resuelven en el banner).
