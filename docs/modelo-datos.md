# Modelo de datos

Fuente: diagrama de clases (`Class_map.drawio`) y migración `V1__esquema_inicial.sql`.

## Entidades
| Entidad | Para qué sirve |
|---|---|
| Usuario | Dueño de todos los datos (`usuario_id` en cada tabla) |
| Tarea | Actividad de agenda, paso de proyecto o subobjetivo. Jerárquica (`padre_id`) |
| Proyecto | Agrupa tareas e ideas. Jerárquico. Pertenece como máximo a un Objetivo |
| Objetivo | Meta con prioridad, subobjetivos (jerárquico) e ideas |
| Idea | Libre, o ligada a un proyecto o a un objetivo (no a ambos) |
| Evento | Cita o compromiso con fecha-hora de inicio y fin |
| Recordatorio | Aviso de una tarea o de un evento (o suelto), por canal APP o CORREO |

## Enums (texto en la base de datos)
- Prioridad: BAJA, MEDIA, ALTA
- Estado (tarea, proyecto, objetivo): PENDIENTE, EN_PROGRESO, EN_PAUSA, CANCELADO, HECHO
- EstadoIdea: PLANTEADA, CONCLUIDA
- Canal: APP, CORREO

## Relaciones (cardinalidad)
- Usuario 1 — 0..n Tarea, Proyecto, Objetivo, Idea, Evento, Recordatorio
- Tarea 0..1 padre — 0..n subtareas
- Proyecto 0..1 padre — 0..n subproyectos
- Objetivo 0..1 padre — 0..n subobjetivos
- Proyecto 0..1 — 0..n Tarea
- Objetivo 0..1 — 0..n Tarea
- Objetivo 0..1 — 0..n Proyecto
- Proyecto 0..1 — 0..n Idea
- Objetivo 0..1 — 0..n Idea
- Tarea 0..1 — 0..1 Recordatorio
- Evento 0..1 — 0..1 Recordatorio

## Reglas de negocio
- Tarea sin `fecha` = pendiente sin agendar. Las abiertas sin fecha (y las atrasadas) alimentan la "recomendación", sean de proyecto, de objetivo, de ambos o de ninguno.
- `hora_inicio` exige `fecha`; `hora_fin` exige `hora_inicio` y debe ser posterior.
- Posponer una tarea: aumenta `veces_pospuesta` y cambia `fecha` (por defecto al día siguiente).
- Tareas atrasadas (`GET /api/tareas/atrasadas?fecha=`): tareas con fecha **estrictamente anterior** a la indicada (el "hoy" del cliente) y estado PENDIENTE, EN_PROGRESO o EN_PAUSA, ordenadas por fecha, luego ALTA primero (sin prioridad al final) y luego id. Las tareas sin fecha no son atrasadas (están sin agendar).
- Recomendación (`GET /api/tareas/recomendacion?fecha=&orden=&sentido=&limite=&proyectoId=&objetivoId=`, `fecha` obligatoria = el "hoy" del cliente): tareas con estado PENDIENTE, EN_PROGRESO o EN_PAUSA (los mismos que `/atrasadas`) y fecha NULL o estrictamente anterior a `fecha`.
  - Se arma un árbol con **todas** las candidatas: una candidata cuya madre también es candidata va anidada bajo ella (todos los niveles); si la madre no es candidata, sale como raíz.
  - `proyectoId` / `objetivoId` filtran por el vínculo directo de la tarea (no consultan esos módulos). Las raíces son las candidatas que cumplen el filtro y no tienen ningún ancestro candidato que también lo cumpla; bajo cada raíz van **todas** sus hijas candidatas, cumplan o no el filtro (vista previa completa, sin duplicados).
  - `orden=prioridad|antiguedad` (por defecto prioridad) y `sentido=desc|asc` (por defecto desc). Prioridad: en desc ALTA primero, en asc BAJA primero; sin prioridad siempre al final. Antigüedad: la `fecha` de la tarea si tiene, si no la fecha de creación; en desc va primero la más antigua. Desempate por id ascendente. También se ordenan las subtareas.
  - `limite` (por defecto 50, máximo 200; debe ser mayor que 0) se aplica después de ordenar, sobre las raíces; cada una lleva su subárbol completo.
  - 400 si falta `fecha`, si `orden`/`sentido` no son válidos o si `limite` no es positivo. Cada elemento devuelto es `{tarea, subtareas:[…]}`.
- Agendar una tarea con sus subtareas (`PATCH /api/tareas/{id}/agendar`, body `{fecha, hoy, incluirSubtareas}`; `fecha` = día nuevo y `hoy` = el "hoy" del cliente, ambas obligatorias; `incluirSubtareas` opcional, por defecto `true`):
  - 404 si la tarea no existe; 409 si la madre no está abierta (PENDIENTE, EN_PROGRESO o EN_PAUSA); 400 si falta `fecha` u `hoy` o si `fecha` < `hoy` (`fecha` = `hoy` es válida).
  - Se modifican la madre (aunque no sea candidata: puede tener fecha de hoy o futura) y, si `incluirSubtareas`, sus descendientes **candidatos** (las mismas candidatas de la recomendación: abiertas y sin fecha o con fecha < `hoy`), bajando solo a través de descendientes candidatos. Es exactamente lo que la vista previa de `/recomendacion` anida bajo esa madre. Una descendiente con fecha >= `hoy`, o HECHO/CANCELADO, se respeta y corta esa rama: lo que cuelga de ella no se toca.
  - A cada tarea modificada: `fecha` = la nueva, se limpian `hora_inicio` y `hora_fin` (queda en la lista del día) y `veces_pospuesta` suma 1 **solo si estaba atrasada** (tenía fecha y era < `hoy`); una tarea sin fecha, o con fecha de hoy o futura, no suma. Vale igual para la madre y las subtareas.
  - Los estados no se propagan ni se modifican. Todo o nada, en una sola transacción.
  - Respuesta: lista de tareas modificadas, la madre primero y luego los descendientes en orden de árbol (hermanas por prioridad, ALTA primero, y luego id).
- Reabrir una tarea (`PATCH /api/tareas/{id}/reabrir`): HECHO pasa a PENDIENTE (no se guarda el estado previo). Si ya está abierta (PENDIENTE, EN_PROGRESO o EN_PAUSA) no cambia: es idempotente. Si está CANCELADO responde 409.
- Una tarea no puede ser su propia descendiente: la API rechaza con 400 un `padreId` que cree un ciclo (directo, A→B→A, o indirecto), igual que en proyectos y objetivos.
- Una idea pasa a CONCLUIDA con `conclusion` y `fecha_cierre`, y queda como registro (trazabilidad).
- Ideas (`/api/ideas`; no son jerárquicas y las notas libres también son ideas):
  - Una idea es libre, o está ligada a un proyecto **o** a un objetivo, nunca a ambos (400). Un `proyectoId` u `objetivoId` inexistente responde 400 ("El proyecto no existe: N" / "El objetivo no existe: N"); la clave foránea queda como red de seguridad. 404 si la idea no existe.
  - `POST`: `titulo` obligatorio (máx. 200); `descripcion` opcional (null se guarda como `''`); `conclusion` opcional (vacía se guarda como null). Nace PLANTEADA y la respuesta trae `fechaCreacion` (la pone la base).
  - `PUT /{id}`: reemplaza `titulo`, `descripcion`, `proyectoId`, `objetivoId` y `conclusion` en cualquier estado; un campo opcional que no viene queda vacío/null (también suelta el vínculo). **No** cambia el estado ni `fecha_cierre`.
  - `GET /api/ideas?estado=&proyectoId=&objetivoId=&libres=`: todos opcionales. `libres=true` = sin ningún vínculo; junto con `proyectoId` u `objetivoId` responde 400 (`libres=false` equivale a no filtrar). Un `estado` que no es PLANTEADA/CONCLUIDA responde 400 con los valores válidos. Orden: fecha de creación descendente y luego id descendente.
  - `PATCH /{id}/concluir` (body opcional `{conclusion}`, también sin body): pasa a CONCLUIDA y `fecha_cierre` = ahora (hora del servidor). Una `conclusion` no vacía reemplaza a la existente; vacía o ausente conserva la anterior. Si ya está CONCLUIDA responde 409.
  - `PATCH /{id}/reabrir`: pasa a PLANTEADA con `fecha_cierre` null y **conserva** la conclusión. Si ya está PLANTEADA no cambia (idempotente).
  - `DELETE /{id}` responde 204; la idea no tiene dependencias.
- Eventos (`/api/eventos`; un evento es una cita o compromiso, no es jerárquico, sin recurrencia ni detección de choques entre eventos):
  - Campos: `titulo` (obligatorio, máx. 200), `descripcion` (opcional; null se guarda como `''`), `fechaHoraInicio` y `fechaHoraFin` (`OffsetDateTime`, obligatorias, ISO con desfase, p. ej. `2026-11-10T15:00:00-03:00`) y `prioridad` opcional (`BAJA|MEDIA|ALTA`). En la base son `TIMESTAMPTZ`: se guarda el **instante**, no el desfase con el que llegó; la respuesta lo devuelve con el desfase de la zona de la JVM del servidor. Los clientes (y los tests) deben comparar instantes, no cadenas.
  - `POST` responde 201; `GET /{id}` 200; `PUT /{id}` es un **reemplazo completo** (un campo opcional que no viene queda vacío/null); `DELETE /{id}` 204. 404 si el evento no existe.
  - 400 si `fechaHoraFin` no es posterior a `fechaHoraInicio` (se comparan instantes; la base también lo rechaza con un `CHECK`, que queda de red de seguridad), si el título está vacío o pasa de 200 caracteres, si faltan las fechas o si algún valor (body o URL) está mal formado.
  - `GET /api/eventos?desde=&hasta=` (ambos opcionales, `OffsetDateTime` ISO con desfase; un `+` del desfase va como `%2B` en la URL). **El servidor no calcula días**: el cliente manda el rango que quiere (p. ej. el día local = 00:00 a 00:00 del día siguiente). Un evento entra si se **solapa** con el rango: `inicio < hasta` **y** `fin > desde`. Por eso un evento que termina exactamente en `desde` NO entra, uno que empieza exactamente en `hasta` NO entra, y uno que cruza la medianoche entra en los dos días. Si falta un extremo, ese lado no se acota (sin ninguno devuelve todos los eventos del usuario). Si vienen los dos y `hasta <= desde` → 400. Orden: `fechaHoraInicio` ascendente y luego id.
  - El solapamiento lo filtra `EventoService` sobre los eventos del usuario ya ordenados por el repository, porque un `@Query` con parámetros `OffsetDateTime` opcionales (`:desde IS NULL OR ...`) falla en PostgreSQL ("could not determine data type of parameter") cuando el valor es null. Para el volumen de una agenda personal es suficiente; si creciera, se puede pasar a consultas con parámetros siempre no nulos.
  - **Decisión de diseño — borrar un evento con recordatorio**: no hay 409. `DELETE /api/eventos/{id}` borra el evento y la base borra su recordatorio en cascada (`recordatorio.evento_id ... ON DELETE CASCADE`). Es una excepción deliberada a "sin cascada desde la API" (ver más abajo), porque un recordatorio no tiene sentido sin su evento; lo mismo vale para el recordatorio de una tarea. Hoy no hay otras dependencias; el módulo recordatorio llega en la 7b.
- Recordatorios (`/api/recordatorios`; aviso de una tarea, de un evento o suelto):
  - Campos: `tareaId`, `eventoId` (ambos opcionales), `fechaHora` (`OffsetDateTime` ISO con desfase, obligatoria), `canal` (`APP|CORREO`, por defecto APP), `enviado` (false al crear) y `descripcion` (opcional; null se guarda como `''`). `fechaHora` se guarda como instante (`TIMESTAMPTZ`); comparar instantes, no cadenas.
  - **Canal CORREO fuera de la v1**: existe en el enum y en la base, pero la API responde 400 ("todavía no disponible") al crear o editar con CORREO. Un `canal` que no es `APP`/`CORREO` también da 400, con los valores válidos en el mensaje. Hoy solo hay notificación dentro de la app.
  - `POST` 201 y `PUT /{id}` (reemplazo completo; `descripcion` omitida → `''`) aplican las mismas validaciones (400): `tareaId` y `eventoId` a la vez; un `tareaId`/`eventoId` inexistente ("La tarea no existe: N" / "El evento no existe: N", vía `TareaService.validarExiste` / `EventoService.validarExiste`; la clave foránea queda de red de seguridad); un recordatorio **suelto** (sin tarea ni evento) necesita `descripcion` no vacía; `fechaHora` obligatoria; canal CORREO o inexistente.
  - **409** si la tarea o el evento ya tiene recordatorio (máximo uno por cada uno; la base lo respalda con `UNIQUE`). En el `PUT` el chequeo se hace **solo si el `tareaId`/`eventoId` cambia** respecto del actual: dejar el mismo vínculo no choca consigo mismo. Los 400 se evalúan antes que los 409.
  - `PUT`: si cambia `fechaHora` (se comparan instantes: el mismo momento con otro desfase no cuenta) `enviado` vuelve a false; si no cambia, `enviado` se conserva.
  - `GET /{id}` (404 si no existe); `GET ?tareaId=&eventoId=` (opcionales; los dos a la vez devuelven lista vacía, porque ninguno puede tener ambos), orden `fechaHora` ascendente y luego id. Los filtros se aplican en el service, no con `@Query` de parámetros null (ver Eventos).
  - `GET /vencidos?ahora=` (`ahora`: `OffsetDateTime` ISO con desfase, **obligatorio**, lo manda el cliente; el servidor no usa su reloj; falta o mal formado → 400): recordatorios con `enviado = false` y `fechaHora <= ahora` (el que está justo en `ahora` entra, uno un instante después no, los enviados no entran), orden `fechaHora` ascendente y luego id.
  - `PATCH /{id}/marcar-enviado`: `enviado = true`, idempotente. `DELETE /{id}` 204. 404 si el recordatorio no existe.
  - **Borrado en cascada desde la base**: borrar una tarea o un evento (`DELETE /api/tareas/{id}`, `DELETE /api/eventos/{id}`) borra su recordatorio (`ON DELETE CASCADE`), sin 409 (excepción deliberada, ver más abajo). `TareaService` y `EventoService` no conocen a recordatorio.
  - **Limitación conocida — tareas cerradas**: el módulo recordatorio no mira el estado de la tarea. El recordatorio pendiente de una tarea HECHA o CANCELADA sigue apareciendo en `/vencidos`. Se resuelve del lado del **frontend**, no del backend: al marcar una tarea como hecha o cancelarla, el frontend consulta `GET /api/recordatorios?tareaId=` y, si tiene un recordatorio pendiente (`enviado = false`), pregunta al usuario si también quiere borrarlo (`DELETE /api/recordatorios/{id}`) o conservarlo. Si la tarea se cierra por otro camino (otro cliente, la API directa), el recordatorio sigue apareciendo como vencido. No hay dependencia de tarea hacia recordatorio.
- Borrar un proyecto u objetivo no borra sus tareas ni ideas: quedan sueltas (`SET NULL`). Borrar un padre jerárquico borra su subárbol.
- Esas reglas son las de la **base de datos**. La **API** es más estricta: nunca borra ni suelta nada "por accidente". Si lo que se borra tiene dependencias, hay que **elegir** qué hacer con cada categoría (`borrar` o `conservar`); sin elección es 409 con el **nombre** del elemento entre comillas angulares. Vale para tareas con subtareas (`DELETE /api/tareas/{id}?subtareas=`, 5d), proyectos y objetivos (ver abajo, 5e). La única excepción deliberada son los recordatorios: borrar un evento o una tarea borra en cascada (en la base) su recordatorio, porque no tiene sentido sin ellos.
- Un proyecto no puede ser su propio descendiente: la API rechaza con 400 cualquier `padreId` que cree un ciclo.
- Los estados no se propagan: cambiar el estado de un proyecto no modifica el de sus subproyectos ni el de sus tareas.
- `proyecto.objetivo_id` y `tarea.objetivo_id` / `tarea.proyecto_id` se guardan como ids simples. Al crear o editar un proyecto, un `objetivoId` inexistente responde 400 ("El objetivo no existe: N"); la clave foránea queda como red de seguridad.
- **Borrar un proyecto o un objetivo eligiendo qué hacer con cada dependencia (5e)**:
  - `DELETE /api/proyectos/{id}?subproyectos=&tareas=&ideas=` y `DELETE /api/objetivos/{id}?subobjetivos=&proyectos=&tareas=&ideas=` (204). Cada parámetro es opcional e independiente y vale `borrar` o `conservar` (sin distinguir mayúsculas; en la interfaz "conservar" se presenta como "mover / dejar suelto"). Vacío = ausente; un valor inválido es 400 (aunque la categoría esté vacía o el elemento no exista); un parámetro sobre una categoría **sin elementos** se ignora. Sin ningún parámetro el comportamiento es el de siempre: 409 ante cualquier dependencia. Todo en una transacción, todo o nada.
  - **409 con el nombre**, en este orden (el primero que falte): proyecto → subproyectos, tareas, ideas; objetivo → subobjetivos, proyectos, tareas, ideas. Ej.: «El objetivo «Salud» tiene proyectos: indica si quieres borrarlos o conservarlos». El nombre es siempre el del elemento pedido, aunque lo que falta decidir esté en un descendiente. **Todos los 409 se evalúan antes de escribir nada.**
  - **Sub-jerarquía** (`subproyectos` / `subobjetivos`): `conservar` → los hijos directos pasan al padre del borrado (o quedan raíz) y sus descendientes los acompañan; `borrar` → se elimina el elemento con todos sus descendientes, de las hojas a la raíz.
  - **`proyectos` (solo objetivos)**: se aplica a los proyectos ligados directamente (`proyecto.objetivo_id`) a **cualquier objetivo que se borra** (el propio y, con `subobjetivos=borrar`, sus descendientes). `conservar` → quedan con `objetivo_id` null, con su sub-árbol, tareas e ideas intactos. `borrar` → se eliminan esos proyectos y todos sus subproyectos, **salvo los rescatados**: un subproyecto ligado a un objetivo que **no** se borra se salva con todo su sub-árbol y pasa al ancestro más cercano que sobrevive (o queda raíz). Un subproyecto sin objetivo, o con un objetivo que también se borra, sigue a su padre y se borra. Un proyecto ligado directamente al objetivo borrado siempre se borra, aunque cuelgue de un rescatado (que queda). Al borrar un **proyecto** (no un objetivo) con `subproyectos=borrar` no hay rescate: se borra todo su sub-árbol.
  - **`tareas`**: alcance = tareas con `proyecto_id` en los proyectos que se borran u `objetivo_id` en los objetivos que se borran (no cuentan los proyectos conservados ni rescatados: sus tareas no se tocan). `conservar` → se pone a null **solo** la columna que apunta a algo borrado (la tarea sigue existiendo y nada más cambia). `borrar` → se elimina cada tarea ligada **con todas sus subtareas de cualquier nivel**, estén o no ligadas a este elemento (incluso si una subtarea está ligada a otro proyecto); sus recordatorios caen por la cascada de la base.
  - **`ideas`**: mismo alcance. `conservar` → quedan libres (columna a null); `borrar` → se eliminan.
  - **Orden de escritura**: primero lo dependiente (tareas, ideas, luego proyectos) y al final la jerarquía del elemento pedido, con flush en cada paso. Es necesario porque la base tiene `ON DELETE CASCADE` en `padre_id` (proyecto, objetivo, tarea) y `SET NULL` en los vínculos: lo que se conserva se reasigna y se persiste **antes** de borrar donde la base haría CASCADE, y si el proyecto u objetivo se borrara antes, el `SET NULL` soltaría tareas e ideas en silencio sin que pudiéramos borrarlas.
  - Implementación: `eliminar` se hace en dos fases, calcular el alcance (solo lectura, lanza los 409) y ejecutarlo (`AlcanceBorradoProyecto` / `AlcanceBorradoObjetivo`), para que la vista previa del impacto (5f, abajo) reutilice la fase 1 sin duplicar la lógica.
- **Vista previa del impacto del borrado (5f)**: para que la interfaz muestre números reales antes de borrar, sin reimplementar la regla del rescate.
  - `GET /api/proyectos/{id}/impacto-borrado?subproyectos=&tareas=&ideas=` y `GET /api/objetivos/{id}/impacto-borrado?subobjetivos=&proyectos=&tareas=&ideas=` (200). Mismos parámetros que el DELETE (`borrar|conservar`, vacío = ausente). **Solo lectura**: no escribe ni hace flush (`@Transactional(readOnly = true)`).
  - Un parámetro **ausente se toma como `conservar`**: la vista previa nunca responde el 409 «indica si quieres…», su trabajo es mostrar qué pasaría con cada elección. Un valor inválido es 400 (se valida antes de buscar el elemento); un id inexistente es 404 con el mismo mensaje que el DELETE.
  - Reutiliza la fase 1 del DELETE (`calcularAlcance`) con las elecciones ausentes completadas con `conservar`, por lo que **los conteos coinciden con lo que luego borra el DELETE con las mismas elecciones** (hay tests de integración que lo comprueban contra la base). El alcance depende de las elecciones anteriores: con `subproyectos=borrar` las tareas e ideas se cuentan en todo el sub-árbol; con `proyectos=borrar`, en los proyectos que se borran y no en los rescatados.
  - Cada categoría trae `total` = elementos sobre los que se elige (los mismos que mira el 409) y `borrados` = filas que **desaparecen** con esa elección, incluidas las arrastradas; es 0 si se conserva. Por eso `borrados` puede ser mayor que `total`: en `tareas`, por las subtareas (ligadas o no) que caen con la tarea ligada, sin contar dos veces una ligada dentro de otra; y en `proyectos` de un objetivo, por los subproyectos sin objetivo de un proyecto ligado. En `subproyectos`/`subobjetivos`, `total` son los hijos directos y `borrados` todo el sub-árbol sin contar al propio elemento. Los recordatorios no se cuentan.
  - Proyectos (de un objetivo) añade `rescatados`: subproyectos que se salvan por estar ligados a un objetivo que no se borra (cuenta la raíz rescatada; su sub-árbol también se salva pero no se suma). Es 0 si `proyectos=conservar`.
  - Respuesta de proyecto: `{ "subproyectos": {total, borrados}, "tareas": {total, borrados}, "ideas": {total, borrados} }`. Respuesta de objetivo: `{ "subobjetivos": {total, borrados}, "proyectos": {total, borrados, rescatados}, "tareas": {total, borrados}, "ideas": {total, borrados} }`.
  - Ejemplo: objetivo O con un subobjetivo y un proyecto P (con un subproyecto sin objetivo SP y otro, R, ligado a otro objetivo), tarea T1 en O con una subtarea sin ligar, T2 en P y T3 en R, y una idea en O. `GET /api/objetivos/{O}/impacto-borrado?subobjetivos=borrar&proyectos=borrar&tareas=borrar` (ideas ausente = conservar):
    ```json
    {
      "subobjetivos": { "total": 1, "borrados": 1 },
      "proyectos":    { "total": 1, "borrados": 2, "rescatados": 1 },
      "tareas":       { "total": 2, "borrados": 3 },
      "ideas":        { "total": 1, "borrados": 0 }
    }
    ```
    (P y SP se borran; R se rescata; T1 con su subtarea y T2 se borran; T3 queda fuera del alcance.)
- Las tareas de un objetivo (`/api/objetivos/{id}/tareas`) son solo las ligadas directamente; los proyectos del objetivo se listan con `GET /api/proyectos?objetivoId=`.
