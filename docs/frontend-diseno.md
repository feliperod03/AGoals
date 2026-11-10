# AGoals: decisiones de diseño del frontend (rebanada 8)

> Fijadas el 7/11/2026; actualizadas el 10/11/2026 (hecho hasta 8.4c; ver el orden de rebanadas). Complementa a `agoals-brief.md`; si se contradicen, avisar.

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

## Subtareas (8.2d `ceab9d9`; vincular existentes en 8.2g `c6afad8`)
Antes de 8.2d el frontend no podía crear subtareas (el backend sí: `padreId` en `TareaRequest`, con validación de padre existente y sin ciclos).
- Ítem **"Agregar subtarea"** en el menú de acciones de cada tarea abierta (no hecha ni cancelada; Hoy y Cofre) y botón en el diálogo de edición (para las tareas de la planificación por horas, que no tienen menú). Desde 8.2g abre primero el diálogo **"Agregar subtarea a «X»"** con dos caminos: **"Crear una nueva"** (foco inicial; abre "Nueva subtarea de «X»" con `padreId` fijado, descripción "Anota el paso que falta." y el aviso `mensajeSubtareaAgregada`) y **"Vincular una existente"** (sección siguiente).
- Una subtarea nueva sin fecha va al Cofre, y el aviso lo dice: "Subtarea agregada a «X»; sin fecha: la verás en el Cofre" (P1a).
- Desde el diálogo de edición, el de elección se abre **encima** (cancelar o vincular deja la edición intacta); la edición solo se reemplaza al elegir "Crear una nueva" (se pierden los cambios sin guardar; está comentado en el código).
- Asignar proyecto u objetivo a una tarea: 8.4b (más abajo).

## Vincular una subtarea existente (8.2g; commit `c6afad8`)
- "Vincular una existente" despliega `BuscadorTareas` (búsqueda por título sin tildes ni mayúsculas, lista de botones nativos, máximo 50 filas), compartido con el selector de madre de 8.2f. Una tarea por vez.
- Candidatas (`candidatasSubtarea`): tareas abiertas, salvo la madre, sus ancestros (evita ciclos; el backend igual da 400) y sus subtareas directas. Si la candidata ya tiene otra madre, la fila dice "Ahora es subtarea de «Z»; se moverá".
- Al elegir: PUT de esa tarea con todos sus campos y el `padreId` nuevo (`requestConPadre`, sobre `aRequest(valoresIniciales(...))`); aviso "«Y» ahora es subtarea de «X»".
- Lista cargando o fallida: solo "Vincular" se deshabilita; "Crear una nueva" siempre está disponible. El error del servidor se ve en el diálogo (estado propio, no el `acciones.error` compartido).
- **Pendiente conocido:** el PUT que reenvía la tarea recorta los segundos de las horas, recorta espacios del título y convierte una descripción vacía en null (ya ocurría con cancelar y reactivar; la interfaz nunca genera segundos).

## Borrar con subtareas (5d `dc6c3c1`; 8.2e `be0913b`)
- **Backend:** `DELETE /api/tareas/{id}?subtareas=borrar|conservar` (204). Sin el parámetro y con subtareas: 409 con el título («X» tiene subtareas: indica si quieres borrarlas o conservarlas). Valor inválido → 400; vacío = ausente. Todo en una transacción.
  - `borrar`: elimina la tarea y todos sus descendientes (de las hojas a la raíz); los recordatorios caen por la cascada de la base.
  - `conservar`: reasigna y persiste (flush) las subtareas directas al padre de la tarea (o sin madre) ANTES de borrar, porque la base tiene `ON DELETE CASCADE` en `padre_id`. Un test contra Postgres real lo cubre.
- **Frontend (`ConfirmarBorradoDialog`):** con subtareas dice "«X» tiene N subtareas" (todos los niveles, de `['tareas','todas']` vía `useTodasLasTareas`, con `descendientesDe` a prueba de ciclos) y ofrece "Conservar las subtareas" (por defecto) o "Borrar también las subtareas" (destructiva). Mientras se consulta la lista ("Comprobando subtareas…") confirmar está deshabilitado; si la lista falla cae al diálogo simple; un 409 refresca la lista. Se invalida `['agenda']`, `['tareas']` y `['recordatorios']`; el aviso usa el título (`mensajeBorrada`).

## Cambiar la madre (8.2f; commit `f195a8b`)
- Campo **"Madre"** solo en el diálogo de edición (`CampoMadre` + `SelectorMadre`): muestra la madre actual y un botón "Cambiar" que abre `BuscadorTareas` con "Sin madre" primero. Candidatas (`candidatasMadre`): abiertas más la madre actual aunque esté cerrada, sin la propia tarea ni sus descendientes.
- Si no se toca el campo, el PUT reenvía el `padreId` original (con la lista cargando o fallida el campo queda deshabilitado). `aRequest(valores, original, padreId)`: `undefined` = sin tocar, `null` = sin madre.
- Aviso: «X» ahora es subtarea de «Y» / «X» ya no es subtarea. En edición se quitó la línea "Subtarea de «X»".
- Escape con la lista abierta cierra solo la lista (`onEscapeKeyDown` + `preventDefault` en el diálogo). **Pendiente conocido:** con el foco fuera del selector (p. ej. en el Título), Escape no hace nada mientras la lista está abierta.

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
- **Chips de filtros activos (P1b; commit `4ff8cc8`):** fila `<ul aria-label="Filtros activos">` bajo la barra, visible con "Más filtros" plegado. Un chip por dimensión fuera de su neutro (fecha ≠ todas, estado ≠ abiertas, prioridad ≠ cualquiera, vínculo ≠ cualquiera) que no tenga un acceso rápido anclado y encendido; la "×" devuelve esa dimensión a su neutro (estado a "abiertas"; fecha también limpia el rango). La búsqueda no genera chip. El botón dice "Más filtros (N)" con N = chips (sin "(0)"). Texto de vacío: "No hay tareas con estos filtros: …" (nombra todos, incluida la búsqueda), "No hay tareas abiertas." si solo queda la línea base y "No hay tareas sin fecha." en la vista por defecto. **Pendiente:** al quitar un chip el foco del teclado se pierde.
- **A decidir tras usar el Cofre:** la vista por defecto (hoy abiertas sin fecha; apagar el acceso rápido "Sin fecha" muestra todas las abiertas) y si ofrecer orden por nombre.
- **Opcional:** contador en Hoy que lleve al cofre.
- **No hay posposición automática:** una tarea no completada queda en su fecha como atrasada; se ve en el cofre (filtro "Atrasadas") y en la recomendación.

## Aviso flotante y color-scheme (P1a; commit `1642c9a`)
- `components/Aviso.tsx` reemplaza el texto plano de Hoy y Cofre: burbuja abajo a la derecha (abajo y centrada en pantallas angostas) con entrada y salida cortas (`motion-safe:`), se cierra sola (6 s, salida de 200 ms por temporizador, no por `transitionend`), con "×", y se pausa con el mouse o el foco. Un aviso nuevo reemplaza al anterior.
- La región `role="status"` es única por página y siempre está en el DOM; los diálogos conservan la suya (Radix deja la página con `aria-hidden`). Queda sobre el overlay (`z-[60]`); el "×" frena `pointerdown` para no cerrar el diálogo modal. Con un diálogo abierto el focus trap impide llegar al "×" con Tab.
- `color-scheme: light` en `:root` y `dark` en `.dark` (`index.css`): íconos de fecha y hora, scroll y desplegables nativos se ven bien en modo oscuro.

## Proyectos y objetivos (8.4a `a388d07`; 8.4a2 `0655bf0`; 8.4a3 `9fd2703`)
Páginas `/proyectos`, `/proyectos/:id`, `/objetivos` y `/objetivos/:id`. Casi idénticas en el backend, así que comparten `features/jerarquia/` (config por tipo `CONFIG_PROYECTO`/`CONFIG_OBJETIVO`, tipo estructural `ItemJerarquico`) y `proyectos/` y `objetivos/` solo tienen los envoltorios y lo propio de cada uno. Sin cambios de backend ni dependencias nuevas.
- **Datos:** el listado y el detalle salen de la lista completa (`['proyectos']`, `['objetivos']`, las mismas claves del Cofre); el detalle no tiene consulta propia ("no encontrado" = lista cargada sin ese id, o id no numérico). Toda mutación invalida las dos listas (`invalidarJerarquia`). El PUT reemplaza todo: siempre se reenvían los seis campos (`requestProyectoDe`/`requestObjetivoDe`), también en el cambio rápido de estado; sin `estado` el backend lo deja en PENDIENTE.
- **Listado:** árbol por `padreId` (`armarArbolJerarquia`, a prueba de ciclos y padres inexistentes), filtro de estado (por defecto, abiertos), búsqueda sin tildes, orden fijo (prioridad y nombre). Un hijo que no cumple el filtro se cuenta como «+N subproyectos ocultos por el filtro»; si el que no cumple es el padre, el hijo sube a raíz con «Subproyecto de «X»». Cada fila: `EstadoIcono` (con la prop `decorativo`, porque aquí el estado se escribe en masculino: «Hecho»), selector de estado nativo, prioridad y, en proyectos, «Objetivo: X».
- **Estados:** el cambio rápido no se propaga a hijos ni a padres. Si el nuevo estado queda fuera del filtro, el aviso lo dice («…pasó a Hecho; ya no se ve con el filtro actual»).
- **Crear/editar:** `ItemDialog` (react-hook-form) con campo «Padre» con búsqueda (`SelectorPadre` sobre `components/BuscadorLista`; no ofrece el propio ni sus descendientes; abiertos más el padre actual) y, en proyectos, `<select>` de objetivo (abiertos más el actual, que siempre figura aunque la lista falle). `EstadoItemDialog.iniciales` permite abrir la creación con valores prefijados.
- **Borrar (8.4a3 `9fd2703`):** `BorrarItemDialog` (uno solo para proyectos y objetivos; `categoriasBorrado` vive en la config de cada tipo). Al abrir pide la vista previa (`GET …/impacto-borrado` de 5f, hook `useImpactoBorrado`; clave `['impacto-borrado', tipo, id, elecciones]` con raíz aparte de `['proyectos']`/`['objetivos']`, `staleTime` 0, `gcTime` 5 s, sin reintentos, `keepPreviousData`) y muestra una fila por categoría con `total > 0` (proyecto: subproyectos, tareas, ideas; objetivo: subobjetivos, proyectos, tareas, ideas). Cada fila (`FilaBorrado`) tiene radios nativos dentro de un `fieldset` «Mover / Borrar», por defecto «Mover». Ayuda de «Mover»: «Pasan al nivel superior», «Quedan sin objetivo», «Quedan sueltas»; con «Borrar» dice cuántos se borran y agrega «(incluye subtareas / subproyectos / subobjetivos)» si `borrados > total` (las ideas nunca). Resumen en vivo en una región `role="status"` propia: «Se borrarán «X», 2 proyectos y 5 tareas.» o «Solo se borrará «X».», más el aviso de proyectos rescatados (solo con `proyectos=borrar`). La elección de una fila se guarda aunque la fila desaparezca y reaparezca (las filas dependen de las elecciones anteriores). **Confirmar** solo se habilita con la respuesta de la elección actual (`isSuccess && !isPlaceholderData && !isFetching`) y manda un parámetro explícito por cada fila visible (`parametrosDe`), nunca por las ocultas; sin filas es el diálogo simple y un DELETE sin parámetros. Si la vista previa falla: «No se pudo calcular qué se borra» + «Reintentar» y no se puede confirmar (nunca un DELETE a ciegas). Si el DELETE da 409 o error, el diálogo queda abierto con el mensaje y se vuelve a pedir la vista previa. Tras borrar (`invalidarTrasBorrado`) se refrescan proyectos, objetivos, `['tareas']`, `['agenda']` y `['recordatorios']`, y el aviso añade lo demás que se borró («…borrado; también 2 proyectos y 5 tareas»). Lógica pura y textos en `features/jerarquia/borrado.ts`; `del()` de `api/client.ts` acepta `query`. Desde el detalle, al borrar se vuelve a la lista llevando el aviso en el `state` del router.
- **Detalle:** datos, padre, hijos directos y secciones propias. En el proyecto, las tareas ligadas (anidadas, de `useTodasLasTareas`). En el objetivo, sus proyectos y «Tareas ligadas directamente» (solo el vínculo directo; las de sus proyectos se ven en cada proyecto). En las dos secciones se puede quitar y vincular tareas (8.4b, sección siguiente).
- **Vincular proyectos y objetivos (8.4a2):** en el detalle del objetivo, «Agregar proyecto» abre una elección «Crear uno nuevo» (el `ItemDialog` de proyecto con el objetivo prefijado) o «Vincular uno existente» (proyectos abiertos que no son ya del objetivo; si el candidato tiene otro, la fila dice «Ahora es del objetivo «Y»; se moverá»), y cada proyecto tiene «Quitar» (queda sin objetivo; no se borra). El botón solo aparece con el objetivo abierto. En el detalle del proyecto, el objetivo se cambia o se quita ahí mismo con un `<select>` en «Datos» (más «Ver objetivo»). Todo es un PUT del proyecto con los seis campos (`useCambiarObjetivo`), con aviso en la región `status` de la página.
- **Pendientes de Pulido 2:** `TareasLigadas` define su propio `esCerrada` (duplica `esAbierto` de `jerarquia/tipos.ts`); `BuscadorTareas` podría ser un adaptador de `BuscadorLista`; `SelectorObjetivo` trataría como "sin objetivo" un id que no estuviera en las opciones (carrera improbable).

## Vincular tareas a proyectos y objetivos (8.4b; commit `0417230`)
Solo frontend, sin dependencias nuevas. Contrato del backend (verificado en el repo antes de planificar, no cambió):
- `PUT /api/proyectos/{id}/tareas/{tareaId}` y `PUT /api/objetivos/{id}/tareas/{tareaId}` (sin cuerpo, 200 con la `Tarea`). Si la tarea ya era de otro proyecto/objetivo, la **reemplaza sin avisar**. No valida el estado del proyecto/objetivo ni el de la tarea.
- `DELETE` de los mismos paths (204). Orden de los errores: 404 si falta el proyecto/objetivo, 404 si falta la tarea, 400 «La tarea N no pertenece al proyecto M» si no corresponde (incluida una tarea sin vínculo).
- **Una tarea puede tener proyecto y objetivo a la vez** (la tabla `tarea` no tiene ese CHECK; sí lo tiene `idea`). Son vínculos independientes: ligar o quitar uno no toca el otro. El PUT de edición de la tarea (`TareaRequest`) nunca manda `proyectoId`/`objetivoId` (un test lo fija).

Frontend:
- **`api/proyectos.ts` y `api/objetivos.ts`:** `asignarTarea(id, tareaId)` (PUT sin cuerpo) y `quitarTarea(id, tareaId)` (DELETE).
- **`useVincularTarea`** (`features/jerarquia/`): una sola mutación (asignar o quitar) por instancia. El guard anti doble envío es un `useRef` que se libera en `onSettled` (no `isPending`, que se actualiza en el siguiente render); cubre también el refresco posterior. Éxito: `alExito` (p. ej. cerrar el buscador), aviso e invalidación de `['agenda']` y `['tareas']`. Error: mensaje del servidor; en 400/404 (el dato estaba viejo) se refrescan agenda y tareas y, solo en 404, la lista de su tipo (`['proyectos']` u `['objetivos']`) para que el borrado salga de los candidatos. Con un error NO se llama a `alExito`: el buscador sigue abierto con el mensaje a la vista.
- **`candidatosVinculo.ts`** (puras, con tests): `candidatosParaTarea` (proyectos/objetivos abiertos más el vigente aunque esté cerrado; orden por nombre), `candidatasTareaParaDestino` (tareas abiertas que no son ya del destino; el detalle dice «Ahora es del proyecto «Y»; se moverá» o «Sin proyecto · 12 nov»), `nombreDe` («n.º N» si la lista no lo tiene) y `CAMPO_DE`.
- **`VincularTareaDialog`** («Proyecto y objetivo de «X»»): dos campos independientes (Proyecto, Objetivo), cada uno con su vínculo actual, «Cambiar» (un solo buscador abierto a la vez) y «Quitar». Cada cambio es una llamada inmediata; no hay Guardar. Elegir el vínculo que ya tiene solo cierra el buscador, sin llamada. Bajo el buscador, «Ahora es del proyecto «Y»; al elegir otro se moverá» solo si ya hay vínculo. El vínculo vigente se lee de `['tareas','todas']` y, si no está, de la foto de la tarea; si estuviera viejo, el 400 de «Quitar» lo corrige. Si la lista de su tipo carga o falla, ese campo entero (Cambiar y Quitar) queda deshabilitado con una nota, nunca hay PUT/DELETE a ciegas, y el otro campo sigue operativo. «Listo» y el cierre del diálogo se bloquean mientras hay una mutación. Las listas se piden con `useQuery(['proyectos'], getProyectos)` y `useQuery(['objetivos'], getObjetivos)` directo (mismas claves y funciones que `useListaJerarquia`, comparten caché) para no arrastrar `jerarquia/config.ts` a Hoy y al Cofre.
- **Puntos de entrada:** (a) ítem «Proyecto y objetivo…» en `MenuAcciones` (Hoy y Cofre, en cualquier estado de la tarea); (b) botón «Proyecto y objetivo…» en las acciones del diálogo de edición (`TareaDialog`), que abre el diálogo ENCIMA de la edición (como 8.2g; el formulario no guarda el vínculo, así que no se pierde lo escrito) y es la única vía para las tareas de la planificación por horas, que no tienen menú; (c) `TareasLigadas` en el detalle de proyectos y objetivos. Estado de apertura en `useAccionesTarea` (`pedirVinculo` y `vinculo: { tarea, cancelar, alMensaje }`), montado una vez en `DialogosAcciones`; la mutación vive en el diálogo.
- **`TareasLigadas`** (props nuevas `nombre`, `abierto`, `alMensaje`): «Quitar» por fila solo en las tareas ligadas directamente (no en las subtareas anidadas que son de otro) y «Vincular una existente» solo con el proyecto/objetivo abierto (como «Agregar proyecto» de 8.4a2), con `BuscadorTareas` sobre las tareas abiertas que no son ya suyas; si la tarea tiene otro, la fila dice «se moverá». El buscador se cierra solo tras un éxito. Error visible en la sección. `ProyectoPage` pasó a usar el contexto de las secciones de `PaginaDetalle`, como `ObjetivoPage`.
- **Avisos** (`lib/fechas.ts`): `mensajeTareaVinculada` («X» ahora es del proyecto «Y») y `mensajeTareaDesvinculada` («X» ya no es del proyecto «Y»), también para objetivos. Salen por la región `status` de la página donde se abrió el diálogo.
- **Regla de capas a mantener:** `agenda/` ahora importa de `jerarquia/` (`DialogosAcciones` → `VincularTareaDialog`) y `jerarquia/` ya importaba de `agenda/` (`EstadoIcono`, `useTodasLasTareas`, `useMensajeTemporal`, `ErrorDialogo`, `descendientes`, `BuscadorTareas`, `candidatasMadre`). No hay ciclo de archivos mientras ningún archivo de `jerarquia/` importe `useAccionesTarea`, `DialogosAcciones`, `MenuAcciones` ni `TareaDialog` (comprobado con grep al cerrar la rebanada).
- **Fuera de alcance:** mostrar el vínculo en las filas de Hoy (el Cofre ya lo muestra), crear una tarea ya ligada (serían un POST y un PUT no atómicos), el vínculo en el formulario de crear/editar, subtareas que heredan el vínculo de la madre, filtros del Cofre.
- **Pendientes conocidos (a Pulido 2):** los avisos de este diálogo salen por la región `status` de la página, que Radix deja con `aria-hidden` mientras hay un diálogo abierto: se ven pero un lector de pantalla no los anunciaría (el campo sí muestra el valor nuevo); la consulta directa de `['proyectos']`/`['objetivos']` está ahora en tres sitios (`VincularTareaDialog`, `TareasLigadas` y `useListaJerarquia`).

## Ideas (8.4c; commit `3548350`)
Página `/ideas` (reemplaza el placeholder «Próximamente»; el ítem del menú lateral ya existía). Solo frontend, sin dependencias nuevas. Contrato del backend (sin cambios, ver el brief): el PUT **reemplaza todo** (título, descripción, vínculo y conclusión) y no cambia el estado; `concluir` acepta un cuerpo opcional `{conclusion}` (vacío o ausente conserva la anterior; ya concluida = 409); `reabrir` es idempotente y conserva la conclusión; proyecto y objetivo a la vez = 400; borrar = 204 directo.
- **Datos:** `GET /api/ideas` completo, clave `['ideas']` (`useIdeas`); filtro y orden en el cliente, sin persistir (como Proyectos). Los filtros `estado`/`proyectoId`/`objetivoId`/`libres` del backend no se usan. Los nombres del vínculo salen de `['proyectos']` y `['objetivos']` (`useListaJerarquia`, caché compartida); con la lista sin cargar, «n.º N».
- **Filtros** (AND, `FiltrosIdeas`): estado (Planteadas por defecto / Concluidas / Todas), vínculo (Todas / Sueltas / De un proyecto / De un objetivo, y un segundo `<select>` con «Cualquier proyecto/objetivo» o uno concreto; ahí van TODOS, también los cerrados, porque una idea puede estar ligada a uno cerrado) y búsqueda en título y descripción sin tildes ni mayúsculas. «Volver a la vista por defecto». El texto de vacío nombra los filtros activos («No hay ideas con estos filtros: …»; «No hay ideas planteadas.» en la vista por defecto; «Aún no tienes ideas.» sin ninguna).
- **Orden:** más recientes primero. Una idea concluida se ordena por su `fechaCierre` (si falta, por la de creación) y una planteada por la de creación; en «Todas» se mezclan a propósito (cada idea por su última novedad). Desempate por id descendente (`ordenarIdeas`, `fechaDeOrden`).
- **Fila:** título, descripción, estado en texto más ícono (Planteada / Concluida), vínculo («Proyecto: X», «Objetivo: Y», «Suelta»), «Creada el…», «Cerrada el…» si está concluida y la conclusión entera en un recuadro (`whitespace-pre-line`; sin colapsable). Menú «Acciones de «título»»: Editar, Concluir (solo planteadas), Reabrir (solo concluidas), Borrar.
- **Crear/editar (`IdeaDialog`, react-hook-form):** título obligatorio (se recorta; vacío, solo espacios o más de 200 caracteres no llaman al servidor), descripción y «Ligada a» (radios Ninguno / Proyecto / Objetivo más `SelectorVinculo` con búsqueda, `candidatosParaTarea`: abiertos más el vigente aunque esté cerrado). El vínculo vive como UN solo par `{tipo, id}` fuera del formulario, así que es imposible mandar proyecto y objetivo a la vez; «Proyecto» sin elegir uno bloquea el envío. **La conclusión solo se edita si la idea ya tiene una o está concluida** (`conclusionEditable`): una idea reabierta conserva su conclusión, el campo aparece y viaja en el PUT; si no se muestra, se reenvía la original (null). `aRequestIdea` manda SIEMPRE los cinco campos (un test fija el cuerpo exacto). Si la lista del tipo vigente carga o falla, el campo entero queda quieto con una nota y se reenvía el vínculo original: nunca un vínculo a ciegas; si falla la del otro tipo, solo se deshabilita su radio. Escape con el selector abierto cierra solo el selector.
- **Concluir (`ConcluirIdeaDialog`):** textarea «Conclusión (opcional)» con la ayuda «Si la dejas vacía se conserva la conclusión anterior (si la hay)»; sin texto (o solo espacios) no se manda cuerpo. **Reabrir:** directo, con aviso; su error sale en la página. **Borrar (`BorrarIdeaDialog`):** confirmación simple, DELETE sin parámetros.
- **Mutaciones (`useAccionesIdeas`):** cuatro `useMutation` (guardar, concluir, reabrir, borrar) con UN guard `useRef` liberado en `onSettled` (una a la vez; un doble clic = una sola llamada; el guard cubre también el refresco posterior). Toda mutación invalida `['ideas']`. Errores: el mensaje del servidor se ve en el diálogo, que queda abierto; 404/409 (la lista estaba vieja) refrescan `['ideas']`; un 400 al guardar (proyecto/objetivo que ya no existe) refresca además `['proyectos']` y `['objetivos']`. Botones deshabilitados con una mutación en curso y diálogo no cerrable mientras guarda.
- **Borrar un proyecto u objetivo** ahora refresca también `['ideas']` (`invalidarTrasBorrado`, con la clave literal para que `jerarquia/` no importe de `ideas/`), porque sus ideas se borran o quedan sueltas.
- **Avisos y fechas** (`lib/fechas.ts`): `mensajeIdeaCreada/Guardada/Concluida/Reabierta/Borrada` («Idea «X» …») y `formatearFechaCorta(iso)` («10 nov 2026»; `parseISO` lleva el instante a la hora local, como `formatearFechaHoraCorta`; hay tests con horas cerca de la medianoche y distintos desfases). Salen por la región `status` de la página.
- **API (`api/ideas.ts`):** `getIdeas`, `crearIdea`, `actualizarIdea` (PUT con el cuerpo completo), `concluirIdea(id, conclusion?)` (recorta; sin texto no manda cuerpo ni Content-Type), `reabrirIdea`, `borrarIdea`.
- **Capas:** `ideas/` importa de `jerarquia/`, `agenda/` y `cofre/estilos`; ningún archivo de `jerarquia/`, `agenda/` ni `cofre/` importa de `ideas/` (comprobado con grep al cerrar la rebanada).
- **Fuera de alcance:** la sección «Ideas ligadas» en el detalle de proyectos y objetivos (8.4d, aparte), crear una idea desde el detalle con el vínculo prefijado, filtros persistidos.
- **Pendientes conocidos:** el PUT reemplaza todo y no hay versionado, así que editar desde una lista vieja puede pisar una conclusión escrita en otra pestaña (se mitiga refrescando `['ideas']` tras cada mutación y en los 404/409); el PUT recorta espacios del título, la descripción y la conclusión al reenviar (mismo pendiente que 8.2g); los avisos de los diálogos no llegan a lectores de pantalla (región `status` de la página bajo `aria-hidden`); `todosComoCandidatos` (`ideas/filtros.ts`) quedó como código muerto (solo lo usa su test) al recortar el filtro de vínculo a `<select>` nativos; el error de «Reabrir» persiste en la página hasta el siguiente intento; `test/renderIdeas.tsx` es un helper de una página dentro de `src/test/`.

## Orden de rebanadas
- 8.0 Esqueleto: hecha (commit `07c1c25`).
- 8.1 Agenda del día en lectura (tareas + eventos, lista del día y horas, próximos recordatorios y eventos): hecha (commit `e9ba44d`).
- 8.2a Crear y editar tareas, hecha (diálogo con formulario; fecha vacía -> cofre; revisar el riesgo del `PUT` antes de editar).
- 8.2b Acciones rápidas, hecha (hecha, reabrir, posponer, cancelar, reactivar, borrar con confirmación; pregunta por el recordatorio pendiente al marcar hecha o cancelar; errores 409 legibles).
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
- 8.4a Páginas de Proyectos y Objetivos (listado en árbol, detalle, crear/editar/borrar, cambio de estado): hecha (commit `a388d07`).
- 8.4a2 Vincular proyectos a un objetivo desde su detalle (agregar, quitar, cambiar el objetivo desde el proyecto): hecha (commit `0655bf0`).
- 5e (backend) Borrar proyectos y objetivos eligiendo qué hacer con cada categoría: `DELETE /api/proyectos/{id}?subproyectos=&tareas=&ideas=` y `DELETE /api/objetivos/{id}?subobjetivos=&proyectos=&tareas=&ideas=` con `borrar|conservar`, mensajes 409 con el nombre: hecha (commit `f17aa98`; semántica en el brief).
- 5f (backend) Vista previa del impacto del borrado: hecha (commit `43ecec5`). `GET /api/proyectos/{id}/impacto-borrado?subproyectos=&tareas=&ideas=` y `GET /api/objetivos/{id}/impacto-borrado?subobjetivos=&proyectos=&tareas=&ideas=` (solo lectura; ausente = conservar, nunca 409). Respuesta por categoría `{total, borrados}` (`proyectos` de un objetivo suma `rescatados`); `borrados` puede superar a `total` por lo arrastrado (subtareas, subproyectos). Contrato completo en el brief.
- 8.4a3 Diálogo de borrado con un interruptor «Mover / Borrar» por categoría (solo las que tienen `total > 0`, resumen en vivo con los `borrados` de 5f): hecha (commit `9fd2703`).
- 8.4b Asignar y quitar el proyecto u objetivo de una tarea (diálogo desde el menú y la edición; «Quitar» y «Vincular una existente» en el detalle): hecha (commit `0417230`). 635 tests de frontend.
- 8.4c Página de Ideas (crear, editar, concluir, reabrir, borrar; filtros de estado, vínculo y búsqueda): hecha (commit `3548350`). 735 tests de frontend.
- 8.4d Ideas ligadas en el detalle de proyectos y objetivos (solo lectura más enlace a `/ideas`): ← próxima.
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
- Selector de hora del formulario: hoy es el input nativo y se ve feo; mejorarlo.
- Al posponer una tarea, su recordatorio pendiente no se mueve con ella (queda en la fecha original).
- Recomendación: el aviso de la página puede aparecer dentro del diálogo aunque venga de otra acción; el error de agendar persiste hasta el siguiente intento.
- Cofre: filtro de vínculo con búsqueda por nombre si la lista de proyectos crece.
- **Pulido 2 (acumulado, además de lo anterior):**
  - Toggle manual de tema claro/oscuro: hoy sigue al sistema; guardar la elección y, sin elección, seguir al sistema.
  - Sombreado al pasar el mouse por una fila del Cofre y de Hoy: el botón de la fila tiene `rounded-lg py-2 hover:bg-muted` sin padding horizontal, así que el sombreado empieza justo en la letra y termina justo en el chip de prioridad. Arreglo: `px-3 -mx-3`, o sombrear la fila completa con el círculo y el menú "⋯".
  - Foco del teclado al quitar un chip del Cofre; Escape con el foco fuera del selector de madre.
  - Proyectos y objetivos: `esCerrada` duplicado en `TareasLigadas`; migrar `BuscadorTareas` a `BuscadorLista`; guarda en `SelectorObjetivo` para un id fuera de las opciones; revisar a ojo el `<select>` de estado de cada fila en pantallas angostas y el título duplicado (h1 y tarjeta) de las páginas; en el diálogo de borrado, el error de un DELETE fallido sigue visible si se cambia un interruptor (se limpia solo al confirmar de nuevo).
  - Vincular tareas (8.4b): los avisos del diálogo no llegan a lectores de pantalla (la región `status` de la página queda `aria-hidden` bajo el diálogo); unificar la consulta directa de `['proyectos']`/`['objetivos']` (hoy en `VincularTareaDialog`, `TareasLigadas` y `useListaJerarquia`); opcional: mostrar el proyecto/objetivo en las filas de Hoy.
  - Ideas (8.4c): quitar `todosComoCandidatos` (código muerto) o usarlo; el error de «Reabrir» persiste hasta el siguiente intento; mover `test/renderIdeas.tsx` junto a la página; los avisos de los diálogos de ideas tampoco llegan a lectores de pantalla.
