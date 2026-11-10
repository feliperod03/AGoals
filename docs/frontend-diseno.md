# AGoals: decisiones de diseño del frontend (rebanadas 8 y 9)

> Fijadas el 7/11/2026; actualizadas el 10/11/2026 (hecho hasta 9a; ver el orden de rebanadas). Complementa a `agoals-brief.md`; si se contradicen, avisar.

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
    ├── features/     agenda (incluye los recordatorios), cofre, recomendacion, jerarquia (compartido por proyectos y objetivos), proyectos, objetivos, ideas, calendario
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
- Sin tocar el campo, el PUT reenvía el `padreId` original. `aRequest(valores, original, padreId)`: `undefined` = sin tocar, `null` = sin madre.
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

## Recomendación (8.3 hecha; commit `f2d0052`)
- Botón secundario "Recomendación" en el encabezado de Hoy; abre un diálogo (Dialog de shadcn) con tareas abiertas sin fecha o atrasadas.
- Controles: orden (Prioridad / Antigüedad), botón de sentido con etiqueta en palabras ("Alta primero", "Más antiguas primero"…), filtro Todos / Proyecto / Objetivo con búsqueda por nombre en el cliente (sin mayúsculas ni tildes) y chip con "×". Un solo filtro a la vez.
- Filas: marca "Sin fecha" / "Atrasada desde <día>" (texto más ícono), chip de prioridad, nombre del proyecto u objetivo si el listado ya cargó, subtareas anidadas como vista previa.
- Agendar: botón por raíz "Agendar «título» para hoy" y checkbox "Incluir N subtareas" (N cuenta todos los niveles; marcado por defecto). Aviso "«X» agendada para hoy (con N subtareas)", con N = tareas devueltas − 1. El diálogo sigue abierto.
- Región `role="status"` propia dentro del diálogo (Radix deja el resto de la página con `aria-hidden`).
- **Pendiente (8.3c, después de la 5c de backend):** toggle "Incluir próximos N días" para ver tareas con fecha futura y adelantarlas a hoy. El uso principal sigue siendo sin fecha y atrasadas. Mientras tanto, el Cofre lo cubre (filtro "Futuras" y "Agendar para hoy").

## Cofre (hecho en 8.3b; commit `a33fcce`)
Inventario de **todas** las tareas, con filtros. Nació como lugar para las tareas "de algún momento" (sin fecha), y ese uso es la vista por defecto. **No requirió cambios en el backend** (`GET /api/tareas`, todo se filtra, ordena y anida en el cliente; clave de query `['tareas', 'todas']`).
- **Vista por defecto:** abiertas sin fecha. "Volver a la vista por defecto" restablece todo.
- **Filtros** (se combinan con AND): fecha (todas / con / sin / atrasadas / futuras / rango inclusivo, las sin fecha quedan fuera del rango), estado (abiertas por defecto, cualquiera de los cinco o todas), prioridad (cualquiera / alta / media / baja / ninguna), vínculo directo (cualquiera / suelta / de un proyecto / de un objetivo, con `<select>` nativos y sin búsqueda por nombre) y búsqueda por título (sin mayúsculas ni tildes).
- **Orden:** por fecha (asc, sin fecha al final), prioridad (alta primero, sin prioridad al final) o antigüedad (fecha de creación; asc = más antiguas primero), con botón de sentido. Al cambiar de orden el sentido vuelve al natural. Por defecto prioridad desc. Desempate por id.
- **Accesos rápidos:** hasta 3, de una sola dimensión (Sin fecha, Con fecha, Atrasadas, Futuras, Prioridad alta/media, Sin prioridad, Pendientes, En progreso, Sueltas). Pulsar uno reemplaza solo su dimensión y suma al resto; si ya está activo vuelve esa dimensión a neutro (apagar uno de estado vuelve a "abiertas", no a "todas"). Por defecto: Sin fecha, Atrasadas, Prioridad alta. Se eligen en "Más filtros" y se guardan en `localStorage['agoals:cofre:anclados']` (lectura y escritura en try/catch, con validación; el estado actual de los filtros no se persiste).
- **Subtareas anidadas:** una tarea que cumple y cuya madre también se anida bajo ella; si la madre no cumple, la hija sube a raíz con "Subtarea de «madre»"; una madre que no cumple no se muestra; "+N subtareas ocultas por el filtro". Protegido contra ciclos y padres inexistentes.
- **Acciones:** las de Hoy (editar, hecha, reabrir, posponer, cancelar, reactivar, borrar) más "Agendar para hoy" en abiertas sin fecha, atrasadas o futuras. Sin subtareas candidatas agenda directo (el error 409/400 sale en el cartel de la página); con candidatas abre un diálogo con "Incluir N subtareas". "Nueva tarea" en el encabezado. `subtareasCandidatas` replica en el cliente la regla de "Agendar con subtareas" del backend.
- **Chips de filtros activos (P1b; commit `4ff8cc8`):** fila `<ul aria-label="Filtros activos">` bajo la barra, visible con "Más filtros" plegado. Un chip por dimensión fuera de su neutro (fecha ≠ todas, estado ≠ abiertas, prioridad ≠ cualquiera, vínculo ≠ cualquiera) que no tenga un acceso rápido anclado y encendido; la "×" devuelve esa dimensión a su neutro (estado a "abiertas"; fecha también limpia el rango). La búsqueda no genera chip. El botón dice "Más filtros (N)" con N = chips (sin "(0)"). Texto de vacío: "No hay tareas con estos filtros: …" (nombra todos, incluida la búsqueda), "No hay tareas abiertas." si solo queda la línea base y "No hay tareas sin fecha." en la vista por defecto. **Pendiente:** al quitar un chip el foco del teclado se pierde.
- **A decidir tras usar el Cofre:** la vista por defecto y si ofrecer orden por nombre. **Opcional:** contador en Hoy que lleve al cofre.
- **No hay posposición automática:** una tarea no completada queda en su fecha como atrasada; se ve en el cofre (filtro "Atrasadas") y en la recomendación.

## Aviso flotante y color-scheme (P1a; commit `1642c9a`)
- `components/Aviso.tsx` reemplaza el texto plano de Hoy y Cofre: burbuja abajo a la derecha (abajo y centrada en pantallas angostas) con entrada y salida cortas (`motion-safe:`), se cierra sola (6 s, salida de 200 ms por temporizador, no por `transitionend`), con "×", y se pausa con el mouse o el foco. Un aviso nuevo reemplaza al anterior.
- La región `role="status"` es única por página y siempre está en el DOM; los diálogos conservan la suya (Radix deja la página con `aria-hidden`). Queda sobre el overlay (`z-[60]`); el "×" frena `pointerdown` para no cerrar el diálogo modal.
- `color-scheme: light` en `:root` y `dark` en `.dark` (`index.css`): íconos de fecha y hora, scroll y desplegables nativos se ven bien en modo oscuro.

## Proyectos y objetivos (8.4a `a388d07`; 8.4a2 `0655bf0`; 8.4a3 `9fd2703`)
Páginas `/proyectos`, `/proyectos/:id`, `/objetivos` y `/objetivos/:id`. Casi idénticas en el backend, así que comparten `features/jerarquia/` (config por tipo `CONFIG_PROYECTO`/`CONFIG_OBJETIVO`, tipo estructural `ItemJerarquico`) y `proyectos/` y `objetivos/` solo tienen los envoltorios y lo propio de cada uno. Sin cambios de backend ni dependencias nuevas.
- **Datos:** el listado y el detalle salen de la lista completa (`['proyectos']`, `['objetivos']`, las mismas claves del Cofre); el detalle no tiene consulta propia ("no encontrado" = lista cargada sin ese id, o id no numérico). Toda mutación invalida las dos listas (`invalidarJerarquia`). El PUT reemplaza todo: siempre se reenvían los seis campos (`requestProyectoDe`/`requestObjetivoDe`), también en el cambio rápido de estado; sin `estado` el backend lo deja en PENDIENTE.
- **Listado:** árbol por `padreId` (`armarArbolJerarquia`, a prueba de ciclos y padres inexistentes), filtro de estado (por defecto, abiertos), búsqueda sin tildes, orden fijo (prioridad y nombre). Un hijo que no cumple el filtro se cuenta como «+N subproyectos ocultos por el filtro»; si el que no cumple es el padre, el hijo sube a raíz con «Subproyecto de «X»». Cada fila: `EstadoIcono` (con la prop `decorativo`, porque aquí el estado se escribe en masculino: «Hecho»), selector de estado nativo, prioridad y, en proyectos, «Objetivo: X».
- **Estados:** el cambio rápido no se propaga a hijos ni a padres. Si el nuevo estado queda fuera del filtro, el aviso lo dice («…pasó a Hecho; ya no se ve con el filtro actual»).
- **Crear/editar:** `ItemDialog` (react-hook-form) con campo «Padre» con búsqueda (`SelectorPadre` sobre `components/BuscadorLista`; no ofrece el propio ni sus descendientes; abiertos más el padre actual) y, en proyectos, `<select>` de objetivo (abiertos más el actual, que siempre figura aunque la lista falle). `EstadoItemDialog.iniciales` permite abrir la creación con valores prefijados.
- **Borrar (8.4a3 `9fd2703`):** `BorrarItemDialog` (uno solo; `categoriasBorrado` en la config de cada tipo). Al abrir pide la vista previa de 5f (`useImpactoBorrado`, clave `['impacto-borrado', tipo, id, elecciones]` con raíz aparte, `staleTime` 0, sin reintentos, `keepPreviousData`) y muestra una fila por categoría con `total > 0`: radios «Mover / Borrar» (por defecto «Mover»), ayuda con cuántos se borran («incluye subtareas…» si `borrados > total`), resumen en vivo en una región `role="status"` propia y aviso de proyectos rescatados. **Confirmar** solo se habilita con la respuesta de la elección actual (`isSuccess && !isPlaceholderData && !isFetching`) y manda un parámetro por cada fila visible (`parametrosDe`). Si la vista previa falla: «No se pudo calcular qué se borra» + «Reintentar», nunca un DELETE a ciegas; si el DELETE falla, el diálogo queda abierto con el mensaje. Tras borrar (`invalidarTrasBorrado`) se refrescan proyectos, objetivos, `['tareas']`, `['agenda']`, `['recordatorios']` e `['ideas']`, y el aviso añade lo demás que se borró. Lógica pura y textos en `features/jerarquia/borrado.ts`; desde el detalle se vuelve a la lista con el aviso en el `state` del router.
- **Detalle:** datos, padre, hijos directos y secciones propias. En el proyecto, las tareas ligadas (anidadas, de `useTodasLasTareas`). En el objetivo, sus proyectos y «Tareas ligadas directamente» (solo el vínculo directo; las de sus proyectos se ven en cada proyecto). En las dos secciones se puede quitar y vincular tareas (8.4b, sección siguiente).
- **Vincular proyectos y objetivos (8.4a2):** en el detalle del objetivo, «Agregar proyecto» abre una elección «Crear uno nuevo» (el `ItemDialog` de proyecto con el objetivo prefijado) o «Vincular uno existente» (proyectos abiertos que no son ya del objetivo; si el candidato tiene otro, la fila dice «Ahora es del objetivo «Y»; se moverá»), y cada proyecto tiene «Quitar» (queda sin objetivo; no se borra). El botón solo aparece con el objetivo abierto. En el detalle del proyecto, el objetivo se cambia o se quita ahí mismo con un `<select>` en «Datos» (más «Ver objetivo»). Todo es un PUT del proyecto con los seis campos (`useCambiarObjetivo`), con aviso en la región `status` de la página.

## Vincular tareas a proyectos y objetivos (8.4b; commit `0417230`)
Solo frontend, sin dependencias nuevas. Contrato del backend (verificado en el repo antes de planificar, no cambió):
- `PUT /api/proyectos/{id}/tareas/{tareaId}` y `PUT /api/objetivos/{id}/tareas/{tareaId}` (sin cuerpo, 200 con la `Tarea`). Si la tarea ya era de otro proyecto/objetivo, la **reemplaza sin avisar**. No valida el estado del proyecto/objetivo ni el de la tarea.
- `DELETE` de los mismos paths (204). Orden de los errores: 404 si falta el proyecto/objetivo, 404 si falta la tarea, 400 «La tarea N no pertenece al proyecto M» si no corresponde (incluida una tarea sin vínculo).
- **Una tarea puede tener proyecto y objetivo a la vez** (la tabla `tarea` no tiene ese CHECK; sí lo tiene `idea`). Son vínculos independientes: ligar o quitar uno no toca el otro. El PUT de edición de la tarea (`TareaRequest`) nunca manda `proyectoId`/`objetivoId` (un test lo fija).

Frontend:
- **`api/proyectos.ts` y `api/objetivos.ts`:** `asignarTarea(id, tareaId)` (PUT sin cuerpo) y `quitarTarea(id, tareaId)` (DELETE).
- **`useVincularTarea`** (`features/jerarquia/`): una sola mutación (asignar o quitar) por instancia. El guard anti doble envío es un `useRef` que se libera en `onSettled` (no `isPending`, que se actualiza en el siguiente render); cubre también el refresco posterior. Éxito: `alExito` (p. ej. cerrar el buscador), aviso e invalidación de `['agenda']` y `['tareas']`. Error: mensaje del servidor; en 400/404 (el dato estaba viejo) se refrescan agenda y tareas y, solo en 404, la lista de su tipo (`['proyectos']` u `['objetivos']`) para que el borrado salga de los candidatos. Con un error NO se llama a `alExito`: el buscador sigue abierto con el mensaje a la vista.
- **`candidatosVinculo.ts`** (puras, con tests): `candidatosParaTarea` (proyectos/objetivos abiertos más el vigente aunque esté cerrado; orden por nombre), `candidatasTareaParaDestino` (tareas abiertas que no son ya del destino; el detalle dice «Ahora es del proyecto «Y»; se moverá» o «Sin proyecto · 12 nov»), `nombreDe` («n.º N» si la lista no lo tiene) y `CAMPO_DE`.
- **`VincularTareaDialog`** («Proyecto y objetivo de «X»»): dos campos independientes (Proyecto, Objetivo), cada uno con su vínculo actual, «Cambiar» (un solo buscador abierto a la vez) y «Quitar». Cada cambio es una llamada inmediata; no hay Guardar. Elegir el vínculo que ya tiene solo cierra el buscador, sin llamada. Bajo el buscador, «Ahora es del proyecto «Y»; al elegir otro se moverá» solo si ya hay vínculo. El vínculo vigente se lee de `['tareas','todas']` y, si no está, de la foto de la tarea; si estuviera viejo, el 400 de «Quitar» lo corrige. Si la lista de su tipo carga o falla, ese campo entero (Cambiar y Quitar) queda deshabilitado con una nota, nunca hay PUT/DELETE a ciegas, y el otro campo sigue operativo. «Listo» y el cierre del diálogo se bloquean mientras hay una mutación. Las listas se piden con `useQuery` directo (mismas claves que `useListaJerarquia`) para no arrastrar `jerarquia/config.ts` a Hoy y al Cofre.
- **Puntos de entrada:** (a) ítem «Proyecto y objetivo…» en `MenuAcciones` (Hoy y Cofre, en cualquier estado de la tarea); (b) botón «Proyecto y objetivo…» en las acciones del diálogo de edición (`TareaDialog`), que abre el diálogo ENCIMA de la edición (como 8.2g; el formulario no guarda el vínculo, así que no se pierde lo escrito) y es la única vía para las tareas de la planificación por horas, que no tienen menú; (c) `TareasLigadas` en el detalle de proyectos y objetivos. Estado de apertura en `useAccionesTarea` (`pedirVinculo` y `vinculo: { tarea, cancelar, alMensaje }`), montado una vez en `DialogosAcciones`; la mutación vive en el diálogo.
- **`TareasLigadas`** (props nuevas `nombre`, `abierto`, `alMensaje`): «Quitar» por fila solo en las tareas ligadas directamente (no en las subtareas anidadas que son de otro) y «Vincular una existente» solo con el proyecto/objetivo abierto (como «Agregar proyecto» de 8.4a2), con `BuscadorTareas` sobre las tareas abiertas que no son ya suyas; si la tarea tiene otro, la fila dice «se moverá». El buscador se cierra solo tras un éxito. Error visible en la sección. `ProyectoPage` pasó a usar el contexto de las secciones de `PaginaDetalle`, como `ObjetivoPage`.
- **Avisos** (`lib/fechas.ts`): `mensajeTareaVinculada` («X» ahora es del proyecto «Y») y `mensajeTareaDesvinculada` («X» ya no es del proyecto «Y»), también para objetivos. Salen por la región `status` de la página donde se abrió el diálogo.
- **Regla de capas a mantener:** `agenda/` ahora importa de `jerarquia/` (`DialogosAcciones` → `VincularTareaDialog`) y `jerarquia/` ya importaba de `agenda/` (`EstadoIcono`, `useTodasLasTareas`, `useMensajeTemporal`, `ErrorDialogo`, `descendientes`, `BuscadorTareas`, `candidatasMadre`). No hay ciclo de archivos mientras ningún archivo de `jerarquia/` importe `useAccionesTarea`, `DialogosAcciones`, `MenuAcciones` ni `TareaDialog` (comprobado con grep al cerrar la rebanada).
- **Fuera de alcance:** vínculo en las filas de Hoy, crear una tarea ya ligada (POST y PUT no atómicos), vínculo en el formulario de crear/editar, herencia del vínculo de la madre.

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
- **Avisos y fechas** (`lib/fechas.ts`): `mensajeIdeaCreada/Guardada/Concluida/Reabierta/Borrada` («Idea «X» …») y `formatearFechaCorta(iso)` («10 nov 2026»). Salen por la región `status` de la página.
- **API (`api/ideas.ts`):** `getIdeas`, `crearIdea`, `actualizarIdea` (PUT con el cuerpo completo), `concluirIdea(id, conclusion?)` (recorta; sin texto no manda cuerpo ni Content-Type), `reabrirIdea`, `borrarIdea`.
- **Capas:** `ideas/` importa de `jerarquia/`, `agenda/` y `cofre/estilos`; ningún archivo de `jerarquia/`, `agenda/` ni `cofre/` importa de `ideas/` (comprobado con grep al cerrar la rebanada).
- **Fuera de alcance:** la sección «Ideas ligadas» en el detalle de proyectos y objetivos (hecha en 8.4d, sección siguiente), crear una idea desde el detalle con el vínculo prefijado, filtros persistidos.
- **Pendiente conocido:** el PUT reemplaza todo y no hay versionado, así que editar desde una lista vieja puede pisar una conclusión escrita en otra pestaña. El resto de los pendientes de ideas está en Pulido 2.

## Ideas ligadas en el detalle (8.4d; commit `8c447ca`)
Tarjeta «Ideas ligadas» en el detalle de proyectos y objetivos, **solo lectura**. Solo frontend, sin dependencias nuevas ni cambios de `api/`, `types/` o `PaginaDetalle`.
- **Qué muestra:** las ideas cuyo vínculo DIRECTO es ese proyecto u objetivo (`ideasLigadas(ideas, campo, id)` filtra con `===` sobre `proyectoId`/`objetivoId`; un proyecto 3 no cuenta para el objetivo 3). No incluye las de los hijos ni las de los proyectos de un objetivo (como «Tareas ligadas directamente»). Planteadas y concluidas mezcladas, orden de `ordenarIdeas` (más recientes primero).
- **Fila:** título, estado en texto más ícono (Planteada / Concluida), «Creada el…» o «Cerrada el…» (`fechaDeOrden`) y, si la hay, la conclusión en un recuadro. Sin descripción, sin menú, sin botones: crear, editar, concluir, reabrir y borrar siguen siendo solo de `/ideas`.
- **Límite:** 5 ideas (`LIMITE_IDEAS_LIGADAS`); si hay más, «+N más» (enlace al mismo destino filtrado). «Ver todas en Ideas» solo aparece con al menos una idea; sin ninguna, solo «Aún no hay ideas ligadas». Cargando: «Cargando ideas…». Error de la lista: `ErrorEnLinea` dentro de la tarjeta y el resto del detalle sigue funcionando.
- **Dónde vive:** `features/ideas/IdeasLigadas.tsx` + `ligadas.ts` (lógica pura y `rutaIdeasDe`). `ProyectoPage` y `ObjetivoPage` (en `proyectos/` y `objetivos/`) lo montan dentro de `secciones`, tras «Tareas ligadas»; así `jerarquia/` sigue sin importar de `ideas/`. Datos de `useIdeas` (`['ideas']`), sin consultas nuevas: lo que se cambie en `/ideas` se ve aquí.
- **Enlace con filtro:** `/ideas?proyecto=N` o `/ideas?objetivo=N`. `IdeasPage` toma el estado inicial de `filtrosDesdeQuery(useSearchParams())`: ese vínculo y estado «Todas» (porque el detalle muestra planteadas y concluidas). Sin parámetro, con un id no numérico o con proyecto y objetivo a la vez, la vista por defecto. Solo se lee al montar; no se sincroniza la URL con los filtros.
- **Tests:** `test/renderIdeas.tsx` ahora envuelve en `MemoryRouter` y acepta una ruta inicial; cinco tests existentes de los detalles suman `vi.mock('@/api/ideas')` porque el detalle ahora pide `['ideas']`. 764 tests de frontend.
- **Capas:** ningún archivo de `jerarquia/`, `agenda/` ni `cofre/` importa de `ideas/` (grep al cerrar la rebanada).
- **Fuera de alcance:** acciones desde el detalle, ideas de hijos o de los proyectos de un objetivo, sincronizar la URL de `/ideas` con los filtros.
- **Pendiente conocido:** si ya estás en `/ideas` y llega otra URL con `?proyecto=` sin desmontar la página, el filtro no se actualiza (solo se lee al montar); hoy no hay forma de llegar así desde la interfaz.

## Aviso de recordatorios vencidos (8.5a; commit `76719fd`)
Solo frontend, sin dependencias nuevas ni cambios de backend. Contrato (sin cambios): `GET /api/recordatorios/vencidos?ahora=` devuelve los no enviados con `fechaHora <= ahora` (por fecha e id, sin mirar el estado de la tarea) y `PATCH /api/recordatorios/{id}/marcar-enviado` (sin cuerpo, idempotente, 404 si no existe).
- **Dónde:** banner EN LÍNEA en el Layout, arriba del `<Outlet/>` (`app/Layout.tsx` monta `<AvisoVencidos />`): se ve en todas las páginas y no usa el `Aviso` flotante de 6 s (se perdería si no estás mirando). Es persistente: sigue hasta pulsar «Entendido» y sobrevive a recargar. Sin vencidos no se ve nada (sin borde ni margen).
- **Solo canal APP:** avisa únicamente con la app abierta (sin scheduler ni notificaciones del navegador).
- **Cuándo se marca como enviado:** SOLO al pulsar «Entendido» (PATCH). Mostrarlo no lo marca (decisión de Felipe del 10/11; cambia lo que decía el brief, «marcar al mostrarlos»).
- **Datos (`useRecordatoriosVencidos`):** clave `['recordatorios','vencidos']` SIN el instante en la clave; la `queryFn` llama a `ahora()` dentro, así cada petición manda la hora real. `refetchInterval` de 30 s (`INTERVALO_VENCIDOS_MS`), `refetchIntervalInBackground` false, `refetchOnWindowFocus` true solo en esta consulta (el default global es false), `staleTime` 0. Invalidar `['recordatorios']` (lo hacen 8.2b, el borrado de tareas y el de proyectos/objetivos) refresca esta consulta por prefijo. Un fallo del polling no se muestra: el banner solo lee `data`, que TanStack conserva entre errores.
- **Banner (`AvisoVencidos`):** región `role="status"` `aria-live="polite"` siempre en el DOM aunque esté vacía (una región que aparece junto con su contenido no se anuncia); es la segunda región `status` de cada página (la otra es la del `Aviso`). Una fila por recordatorio (`FilaVencido`): texto (`useTituloRecordatorio`: descripción o, si no hay, el título de la tarea/evento), «Para el <fecha y hora corta>» y botón «Entendido». Máximo 5 filas (`MAX_VENCIDOS_VISIBLES`) y «+N más pendientes»; al descartar entran las siguientes. Orden del servidor.
- **«Entendido» (`useMarcarEnviado`):** una mutación a la vez con guard `useRef` liberado en `onSettled` (como `useVincularTarea`). Éxito: `await invalidateQueries(['recordatorios'])`, así el guard sigue tomado hasta que la fila ya no está. Error: el mensaje del servidor queda bajo esa fila y el botón vuelve a estar activo; con 404 se refresca la lista y la fila se va (el mensaje apenas llega a verse). Todos los «Entendido» se deshabilitan mientras hay una llamada.
- **Tareas cerradas:** un vencido de una tarea hecha o cancelada por otro camino se muestra igual (limitación documentada en `modelo-datos.md`); no se consulta el estado de la tarea.
- **API:** `getRecordatoriosVencidos(ahora)` y `marcarRecordatorioEnviado(id)` en `api/recordatorios.ts`. `types/recordatorio.ts` no cambió en 8.5a (`canal` se agregó en 8.5b).
- **Ubicación y capas:** `features/agenda/` (`vencidos.ts`, `useRecordatoriosVencidos.ts`, `AvisoVencidos.tsx`), junto a los demás hooks de recordatorios; `app/Layout.tsx` importa de `features/agenda/`, como `App.tsx` con `HoyPage`. Ningún archivo de `agenda/` importa de `app/`. Deliberado: en 8.5b `agenda/` importa el diálogo de recordatorio, así que lo nuevo de recordatorios no debe vivir en una carpeta que importe de `agenda/` (ciclo).

## Recordatorios: crear, editar y borrar (8.5b; commit `2780858`)
Solo frontend, sin dependencias nuevas ni cambios de backend. Contrato (sin cambios): `POST /api/recordatorios` y `PUT /api/recordatorios/{id}` (reemplazo completo: `tareaId`, `eventoId`, `fechaHora`, `canal`, `descripcion`), solo canal APP, máximo uno por tarea (409), suelto con descripción obligatoria, 404 si ya no existe. Si cambia el instante de `fechaHora`, `enviado` vuelve a false.
- **Un solo diálogo (`RecordatorioDialog`)** con la prop `destino`: `{tipo:'tarea', tarea}` («Recordatorio de «X»»), `{tipo:'suelto'}` («Nuevo recordatorio») y `{tipo:'existente', recordatorio}` («Editar recordatorio»). Comparten formulario, hook y textos, por eso no son dos diálogos. Se monta solo mientras está abierto y no se cierra con una mutación en curso. Estado local, sin react-hook-form (son dos campos).
- **Modo tarea:** se consulta el recordatorio de la tarea (`useRecordatorioDeTarea`, clave `['recordatorios',{tareaId}]`, la misma de 8.2b; `cargando` incluye los refrescos). Mientras carga o si falla («No se pudo consultar el recordatorio de esta tarea» + «Reintentar») los campos y botones quedan deshabilitados: nunca se escribe a ciegas. Sin recordatorio: «Crear recordatorio»; con uno: «Guardar cambios» y «Quitar recordatorio» (inmediato, sin confirmar, como pidió Felipe). Cada acción es una llamada inmediata y el diálogo queda abierto (se cierra con «Listo»); el formulario se reinicia con `key` según el id del recordatorio, así que tras un 409 al crear (el refresco trae el existente) pasa a editar solo, y tras un 404 vuelve a crear. Puede abrirse encima del diálogo de edición de la tarea.
- **Modo suelto y existente:** se cierra al guardar o borrar. Borrar desde una fila pide confirmación dentro del mismo diálogo («Conservar» / «Borrar recordatorio»). La descripción es obligatoria (se recorta; vacía = error local sin llamada) solo si no hay `tareaId` ni `eventoId`; el PUT conserva `tareaId`, `eventoId` y `canal` tal cual. No se puso `maxLength` (el backend no define límite).
- **Valores por defecto (`recordatorioForm.ts`):** tarea con `horaInicio` → esa fecha y hora; solo fecha → ese día a las 09:00 (`HORA_POR_DEFECTO`); sin fecha, y todo suelto → mañana a las 09:00. Si el instante elegido ya pasó, nota «Esa hora ya pasó: el aviso saldrá enseguida.» sin bloquear (el banner de 8.5a lo mostrará). Descripción opcional en tareas (se envía `""`).
- **Fechas (`lib/fechas.ts`):** `aValorDatetimeLocal` (ISO con desfase → `yyyy-MM-dd'T'HH:mm` en hora local), `deValorDatetimeLocal` (→ `aIsoConDesfase`, o `null` si el campo está vacío o es inválido: nunca se manda un `Invalid Date`) y los mensajes `mensajeRecordatorioCreado/Guardado/Quitado`.
- **Mutaciones (`useAccionesRecordatorio`):** una sola mutación con acción `crear|actualizar|borrar`; guard `useRef` liberado en `onSettled`; el éxito hace `await invalidateQueries(['recordatorios'])` (refresca banner, Próximos y la consulta por tarea); 404 y 409 refrescan y dejan el mensaje del servidor en `error`. `resultado` alimenta la región `role="status"` del diálogo, además del aviso de la página.
- **Dónde se abre:** ítem «Recordatorio…» en `MenuAcciones` y botón en `AccionesDeLaTarea` de `TareaDialog`, solo en tareas **abiertas** (reusa `puedeAgregarSubtarea`). `useAccionesTarea` expone `pedirRecordatorio` y `recordatorioTarea` (mismo patrón que `vinculo`) y `DialogosAcciones` lo monta. En la tarjeta «Próximos recordatorios» (`ColumnaLateral`): botón «Nuevo recordatorio» debajo de la lista (también con la tarjeta vacía) y «Editar» por fila.
- **API y tipos:** `crearRecordatorio` y `actualizarRecordatorio` en `api/recordatorios.ts`; `types/recordatorio.ts` agrega `Canal` (`'APP' | 'CORREO'`), `canal` a `Recordatorio` y `RecordatorioRequest`. La interfaz solo manda `'APP'` (editar uno con CORREO daría 400, visible).
- **Capas:** todo en `features/agenda/`; ningún archivo nuevo o modificado importa de `app/`, `jerarquia/` ni `ideas/` (el import de `jerarquia/` en `DialogosAcciones` ya existía).
- **Pendiente conocido:** la tarjeta «Próximos» solo muestra los 3 siguientes sin enviar, así que un vencido o el cuarto no se edita desde ahí (el de una tarea siempre se alcanza desde su menú). El resto está en Pulido 2.

## Mover el recordatorio al posponer (8.5c; commit `e7aa911`)
Solo frontend, sin dependencias nuevas ni backend.
- **`PosponerDialog`** consulta el recordatorio (`useRecordatorioDeTarea`, solo con el selector abierto; los botones esperan mientras carga, «Cancelar» no). Hay algo que mover si existe, tiene `enviado=false` y la tarea tiene fecha; si no, no hay casilla. Si la consulta falla: nota «No se pudo consultar el recordatorio de esta tarea: si tiene uno, no se moverá» y se pospone sin mover.
- **Casilla «Mover también el recordatorio (cae el …)»**, marcada por defecto, para «Mañana» y «Elegir fecha». La ayuda muestra el instante nuevo de cada destino («Con Mañana: …», «Con la fecha elegida: …») y «Seguirá vencido: el aviso saldrá enseguida.» si aun movido queda en el pasado (se mueve igual: una sola regla). Desmarcada: «El recordatorio se queda donde está.». «Dejar sin fecha» nunca lo mueve: la ayuda y el aviso (`mensajeSinFechaConRecordatorio`) lo dicen.
- **Cómputo (`lib/fechas.ts`):** `diasEntre` (días de calendario entre la fecha de la tarea y la que confirmó el backend) y `moverInstanteDias` (`addDays` sobre un `Date` local: conserva la hora de pared aunque cambie el horario). Un aviso puesto un día antes de la tarea sigue un día antes.
- **Hook (`useAccionesTarea`):** `ejecutar(tipo, tarea, fecha?, recordatorio?)`. En `'posponer'`: PATCH y luego PUT con los cinco campos (`requestMovido`, en `recordatorioForm.ts`); `ejecutarAccion` ignora un recordatorio ya enviado. Si el PUT falla (404/409/500) no se relanza: la tarea queda pospuesta, el selector se cierra y el aviso lleva el mensaje del servidor (`mensajeRecordatorioNoMovido`). Éxito: `mensajeRecordatorioMovido`. Si se pasó un recordatorio se invalida `['recordatorios']`. En `'sinFecha'` solo cambia el texto del aviso. Un guard `useRef` (`enCurso`) protege a todas las acciones del doble clic.

## Calendario mensual (9a; commit `26c36bd`)
Solo frontend, sin dependencias nuevas ni backend. Grilla propia con date-fns (decidido: sin librería; a igual usabilidad, lo más estético). Ruta `/calendario`, todo en `features/calendario/`.
- **Datos:** eventos con `useEventosEnRango` (`['eventos','rango',desde,hasta]`, rango de la cuadrícula visible con `rangoDeFechas`, `keepPreviousData`: al cambiar de mes se conservan los eventos de los días compartidos y «Cargando…» sale de `isFetching`); tareas de `['tareas','todas']` filtradas por fecha en el cliente (CANCELADO oculto, HECHO atenuado). Cada fuente falla por separado. 9b reusa `useEventosEnRango` con el rango de la semana; 9c invalida `['eventos']`.
- **Lógica pura (`calendario.ts`):** `elementosPorDia` (un tramo por cada día que toca un evento: `tramoDelEventoEnDia` de `lib/fechas.ts`), orden (con hora por minuto de inicio y el evento antes que la tarea; sin hora por prioridad e id), `recortarParaCelda` (3 líneas; con más, 2 + «+N más»), `textoHora` («desde 22:00», «hasta 06:00», «Todo el día», «22:00–00:00», nunca «24:00»), `etiquetaDia`, `estadoDesdeUrl`, `diaDestino` (teclado). En `lib/fechas.ts`: `semanasDelMes` (lunes a domingo), `limitesDeSemana`, `sumarMeses`, `moverMesConservandoDia`, `parsearMes`, `esFechaValida`.
- **URL:** `?mes=YYYY-MM&dia=YYYY-MM-DD`, derivados en el render (inválido = valor por defecto, sin reescribir la URL). Lo que cambia el mes hace push (‹ › Hoy, y el teclado que sale de la cuadrícula); cambiar solo el día dentro de la cuadrícula hace replace.
- **Clic en un día:** lo selecciona y el panel «Detalle del día» (solo lectura: hora, estado, prioridad, «Atrasada») muestra todo lo suyo. No navega a Hoy porque `HoyPage` no admite otra fecha.
- **Accesibilidad:** `role="grid"` con roving tabindex; cada día es un botón con `aria-label` («martes 10 de noviembre, hoy, 2 eventos, 3 tareas»); flechas ±1 / ±7, Inicio/Fin, RePág/AvPág. El panel es un `aside` con nombre y su título no es región viva.
- **Aspecto:** una sola tarjeta, números en Fraunces, hoy en círculo `acc`, seleccionado con anillo; evento = rectángulo, tarea = píldora con el círculo de estado.
- **Responsive (container queries sobre la cuadrícula, medido con Playwright):** < 640 px marcas sin texto; 640–980 chips solo con título; ≥ 980 chips con hora. Un evento de varios días lleva flecha + título (su hora va en el `title` y en el panel). El panel va al lado solo con ≥ 1224 px de contenido (~1560 px de ventana); debajo ocupa todo el ancho, en dos columnas con ≥ 600 px. Felipe usa ventanas de ≤ 1280 px: cuadrícula de 945 px y chips de solo título.
- **Capas:** `calendario/` importa de `agenda/` (`horario`, `useAhora`, `useTodasLasTareas`, `EstadoIcono`); ningún archivo de `agenda/`, `jerarquia/`, `cofre/` ni `ideas/` importa de `calendario/`. Solo `useEventosEnRango` toca `@/api`.
- **Fuera de alcance:** vista semanal (9b), crear/editar/borrar eventos (9c), recordatorios de evento (9d), vista anual, barras continuas para eventos largos.
- **Pendientes:** a Pulido 2 (abajo).

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
- 5f (backend) Vista previa del impacto del borrado: hecha (commit `43ecec5`). `GET …/impacto-borrado` de proyectos y objetivos, solo lectura, ausente = conservar; contrato en el brief.
- 8.4a3 Diálogo de borrado con un interruptor «Mover / Borrar» por categoría (solo las que tienen `total > 0`, resumen en vivo con los `borrados` de 5f): hecha (commit `9fd2703`).
- 8.4b Asignar y quitar el proyecto u objetivo de una tarea (diálogo desde el menú y la edición; «Quitar» y «Vincular una existente» en el detalle): hecha (commit `0417230`). 635 tests de frontend.
- 8.4c Página de Ideas (crear, editar, concluir, reabrir, borrar; filtros de estado, vínculo y búsqueda): hecha (commit `3548350`). 735 tests de frontend.
- 8.4d Ideas ligadas en el detalle de proyectos y objetivos (solo lectura más enlace a `/ideas` con el filtro puesto): hecha (commit `8c447ca`). 764 tests de frontend.
- 8.5a Aviso de recordatorios vencidos (banner persistente en el Layout; polling de `/vencidos` cada 30 s; «Entendido» marca como enviado): hecha (commit `76719fd`). 782 tests de frontend.
- 8.5b Crear, editar y borrar recordatorios (diálogo propio desde la tarea; sueltos desde Hoy con «Nuevo recordatorio» y «Editar» por fila): hecha (commit `2780858`). 824 tests de frontend. El aviso al cerrar una tarea con recordatorio pendiente ya se hizo en 8.2b.
- 8.5c Mover el recordatorio al posponer (casilla en `PosponerDialog`): hecha (commit `e7aa911`). 857 tests de frontend.
- 9a Calendario mensual en lectura (grilla propia; eventos y tareas con fecha; detalle del día; URL `?mes=&dia=`): hecha (commit `26c36bd`). 980 tests de frontend.
- 9b Vista semanal en lectura: ← próxima. 9c CRUD de eventos. 9d Recordatorios de evento (el backend ya los soporta con `eventoId`; la interfaz es la de 8.5b).
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
- Planificación por horas: un evento que cruza la medianoche estira el rango a 00:00 y deja una franja larga vacía; posible mejora futura: plegar las horas vacías.
- Etiquetas de prioridad: hoy se ven "Alta/Media/Baja"; el boceto decía "ALTA/MEDIA/BAJA" (cosmético).
- Selector de hora del formulario: hoy es el input nativo y se ve feo; mejorarlo.
- Recomendación: el aviso de la página puede aparecer dentro del diálogo aunque venga de otra acción; el error de agendar persiste hasta el siguiente intento.
- Cofre: filtro de vínculo con búsqueda por nombre si la lista de proyectos crece.
- **Pulido 2 (acumulado, además de lo anterior):**
  - Toggle manual de tema claro/oscuro: hoy sigue al sistema; guardar la elección y, sin elección, seguir al sistema.
  - Sombreado al pasar el mouse por una fila del Cofre y de Hoy: el botón de la fila tiene `rounded-lg py-2 hover:bg-muted` sin padding horizontal, así que el sombreado empieza justo en la letra y termina justo en el chip de prioridad. Arreglo: `px-3 -mx-3`, o sombrear la fila completa con el círculo y el menú "⋯".
  - Foco del teclado al quitar un chip del Cofre; Escape con el foco fuera del selector de madre.
  - Proyectos y objetivos: `esCerrada` duplicado en `TareasLigadas`; migrar `BuscadorTareas` a `BuscadorLista`; guarda en `SelectorObjetivo` para un id fuera de las opciones; revisar a ojo el `<select>` de estado de cada fila en pantallas angostas y el título duplicado (h1 y tarjeta) de las páginas; en el diálogo de borrado, el error de un DELETE fallido sigue visible si se cambia un interruptor (se limpia solo al confirmar de nuevo).
  - Vincular tareas (8.4b): los avisos del diálogo no llegan a lectores de pantalla (la región `status` de la página queda `aria-hidden` bajo el diálogo); unificar la consulta directa de `['proyectos']`/`['objetivos']` (hoy en `VincularTareaDialog`, `TareasLigadas` y `useListaJerarquia`); opcional: mostrar el proyecto/objetivo en las filas de Hoy.
  - Ideas (8.4c): quitar `todosComoCandidatos` (código muerto) o usarlo; el error de «Reabrir» persiste hasta el siguiente intento; mover `test/renderIdeas.tsx` junto a la página; los avisos de los diálogos de ideas tampoco llegan a lectores de pantalla.
  - Aviso de vencidos (8.5a): bajo un diálogo abierto el banner queda con `aria-hidden` y un lector de pantalla no lo anunciaría; el test del 404 de «Entendido» no comprueba el mensaje.
  - Recordatorios (8.5b): renombrar el criterio de «tarea abierta» que hoy se llama `puedeAgregarSubtarea`; indicar en el diálogo de tarea que el recordatorio ya fue enviado; tras un 404 al editar una fila ofrecer una salida clara; los avisos del diálogo de recordatorio tampoco llegan a lectores de pantalla.
  - Posponer con recordatorio (8.5c): aviso persistente ante el fallo parcial (el de 6 s puede pasar desapercibido); ayuda vacía de la casilla si no hay destino calculable.
  - Calendario (9a): con el panel debajo (ventanas de menos de ~1560 px) el detalle del día queda bajo el pliegue (posible scroll suave hasta el panel, solo con clic); subir la base de la cuadrícula de 900 a 980 px si se usa una pantalla grande (así conserva la hora en los chips al pasar a «panel al lado»); «Hoy» pulsado varias veces podría apilar entradas de historial (sin verificar).
