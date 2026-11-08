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
- Borrar un proyecto u objetivo no borra sus tareas ni ideas: quedan sueltas (`SET NULL`). Borrar un padre jerárquico borra su subárbol.
- Esas reglas son las de la **base de datos**. La **API** es más estricta: `DELETE /api/proyectos/{id}` responde 409 si el proyecto tiene subproyectos, tareas o ideas (hay que moverlos o desasignarlos antes), y `DELETE /api/tareas/{id}` responde 409 si la tarea tiene subtareas (hay que moverlas o borrarlas antes). No se borra nada en cascada desde la API, salvo la excepción deliberada de los recordatorios: borrar un evento o una tarea borra en cascada (en la base) su recordatorio, porque no tiene sentido sin ellos.
- Un proyecto no puede ser su propio descendiente: la API rechaza con 400 cualquier `padreId` que cree un ciclo.
- Los estados no se propagan: cambiar el estado de un proyecto no modifica el de sus subproyectos ni el de sus tareas.
- `proyecto.objetivo_id` y `tarea.objetivo_id` / `tarea.proyecto_id` se guardan como ids simples. Al crear o editar un proyecto, un `objetivoId` inexistente responde 400 ("El objetivo no existe: N"); la clave foránea queda como red de seguridad.
- `DELETE /api/objetivos/{id}` responde 409 si el objetivo tiene subobjetivos, proyectos, tareas ligadas directamente (`tarea.objetivo_id`) o ideas ligadas (`idea.objetivo_id`); el mensaje indica cuál.
- Las tareas de un objetivo (`/api/objetivos/{id}/tareas`) son solo las ligadas directamente; los proyectos del objetivo se listan con `GET /api/proyectos?objetivoId=`.
