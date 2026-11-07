# Roadmap por rebanadas

Cada rebanada termina con tests pasando, revisión del diff y un commit.

1. **Arranque**: la app levanta, conecta a PostgreSQL y Flyway aplica `V1`. Test de contexto en verde.
2. **Tarea (CRUD)**: entidad, repository, service, controller, DTOs y tests.
3. **Agenda del día**: listar tareas por fecha, marcar como hecha, posponer (aumenta `veces_pospuesta` y mueve la fecha).
4. **Proyectos y Objetivos**, en tres partes:
   - **4a Proyecto** (hecha): CRUD con jerarquía, estados, filtros y tareas asignadas.
   - **4b Objetivo** (hecha): CRUD con jerarquía, mapeo de `tarea.objetivo_id` y tareas ligadas a un objetivo, y validación explícita de `objetivoId` en Proyecto (vía `ObjetivoConsultaService`).
   - **4c Tareas** (hecha): tareas con fecha pasada y sin terminar visibles (`GET /api/tareas/atrasadas?fecha=`), reabrir tareas marcadas como hechas por error (`PATCH /api/tareas/{id}/reabrir`), detección de ciclos en la jerarquía de `TareaService` y 409 al borrar una tarea con subtareas (sin cascada desde la API).
5. **Recomendación** (hecha): `GET /api/tareas/recomendacion?fecha=&orden=&sentido=&limite=&proyectoId=&objetivoId=`. Solo lectura, en el módulo tarea. Sugiere tareas abiertas **sin fecha o atrasadas**, de cualquier tipo (con proyecto, con objetivo, con ambos o sin ninguno; también madres), con subtareas anidadas, ordenadas por prioridad o antigüedad. Decidido: incluye las ligadas solo a un objetivo.
   - **5b Agendar tarea con sus subtareas** (hecha): `PATCH /api/tareas/{id}/agendar` con `{fecha, hoy, incluirSubtareas}`. Escritura en el módulo tarea: asigna la nueva fecha a la madre y, por defecto, a sus descendientes candidatos (los mismos que la vista previa de `/recomendacion` anida bajo ella). Las descendientes con fecha de hoy o futura y las hechas/canceladas se respetan. Todo o nada.
6. **Ideas**: libres o ligadas a proyecto/objetivo, estado y conclusión.
   - Al llegar a esta rebanada, `ObjetivoService.eliminar` (y el borrado de proyectos) debe pasar a dar 409 también si el objetivo o proyecto tiene ideas; hoy la base les hace SET NULL en silencio porque el módulo idea no existe.
7. **Eventos y Recordatorios**: citas y avisos (primero dentro de la app).
8. **Frontend React**: agenda del día primero, luego el resto.
9. **Calendario**: vistas mensual y semanal (librería, no a mano).
