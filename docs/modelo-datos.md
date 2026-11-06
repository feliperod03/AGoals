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
- Tarea sin `fecha` = pendiente sin agendar. Las pendientes de proyecto sin fecha alimentan la "recomendación".
- `hora_inicio` exige `fecha`; `hora_fin` exige `hora_inicio` y debe ser posterior.
- Posponer una tarea: aumenta `veces_pospuesta` y cambia `fecha` (por defecto al día siguiente).
- Tareas atrasadas (`GET /api/tareas/atrasadas?fecha=`): tareas con fecha **estrictamente anterior** a la indicada (el "hoy" del cliente) y estado PENDIENTE, EN_PROGRESO o EN_PAUSA, ordenadas por fecha, luego ALTA primero (sin prioridad al final) y luego id. Las tareas sin fecha no son atrasadas (están sin agendar).
- Reabrir una tarea (`PATCH /api/tareas/{id}/reabrir`): HECHO pasa a PENDIENTE (no se guarda el estado previo). Si ya está abierta (PENDIENTE, EN_PROGRESO o EN_PAUSA) no cambia: es idempotente. Si está CANCELADO responde 409.
- Una tarea no puede ser su propia descendiente: la API rechaza con 400 un `padreId` que cree un ciclo (directo, A→B→A, o indirecto), igual que en proyectos y objetivos.
- Una idea pasa a CONCLUIDA con `conclusion` y `fecha_cierre`, y queda como registro (trazabilidad).
- Borrar un proyecto u objetivo no borra sus tareas ni ideas: quedan sueltas (`SET NULL`). Borrar un padre jerárquico borra su subárbol.
- Esas reglas son las de la **base de datos**. La **API** es más estricta con los proyectos: `DELETE /api/proyectos/{id}` responde 409 si el proyecto tiene subproyectos o tareas (hay que moverlos o desasignarlos antes). No se borra nada en cascada desde la API.
- Un proyecto no puede ser su propio descendiente: la API rechaza con 400 cualquier `padreId` que cree un ciclo.
- Los estados no se propagan: cambiar el estado de un proyecto no modifica el de sus subproyectos ni el de sus tareas.
- `proyecto.objetivo_id` y `tarea.objetivo_id` / `tarea.proyecto_id` se guardan como ids simples. Al crear o editar un proyecto, un `objetivoId` inexistente responde 400 ("El objetivo no existe: N"); la clave foránea queda como red de seguridad.
- `DELETE /api/objetivos/{id}` responde 409 si el objetivo tiene subobjetivos, proyectos o tareas ligadas directamente (`tarea.objetivo_id`); el mensaje indica cuál. Las ideas ligadas aún no se comprueban (módulo idea: rebanada 6).
- Las tareas de un objetivo (`/api/objetivos/{id}/tareas`) son solo las ligadas directamente; los proyectos del objetivo se listan con `GET /api/proyectos?objetivoId=`.
