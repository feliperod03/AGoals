# Roadmap por rebanadas

Cada rebanada termina con tests pasando, revisión del diff y un commit.

1. **Arranque**: la app levanta, conecta a PostgreSQL y Flyway aplica `V1`. Test de contexto en verde.
2. **Tarea (CRUD)**: entidad, repository, service, controller, DTOs y tests.
3. **Agenda del día**: listar tareas por fecha, marcar como hecha, posponer (aumenta `veces_pospuesta` y mueve la fecha).
4. **Proyectos y Objetivos**, en tres partes:
   - **4a Proyecto** (hecha): CRUD con jerarquía, estados, filtros y tareas asignadas.
   - **4b Objetivo** (hecha): CRUD con jerarquía, mapeo de `tarea.objetivo_id` y tareas ligadas a un objetivo, y validación explícita de `objetivoId` en Proyecto (vía `ObjetivoConsultaService`).
   - **4c Tareas** (hecha): tareas con fecha pasada y sin terminar visibles (`GET /api/tareas/atrasadas?fecha=`), reabrir tareas marcadas como hechas por error (`PATCH /api/tareas/{id}/reabrir`), detección de ciclos en la jerarquía de `TareaService` y 409 al borrar una tarea con subtareas (sin cascada desde la API).
5. **Recomendación**: endpoint que sugiere tareas de proyecto pendientes y sin fecha, ordenadas por prioridad.
   - Pregunta abierta: ¿incluye también las tareas ligadas solo a un objetivo (`objetivo_id` sin `proyecto_id`)? Decidir antes de planificar esta rebanada.
6. **Ideas**: libres o ligadas a proyecto/objetivo, estado y conclusión.
   - Al llegar a esta rebanada, `ObjetivoService.eliminar` (y el borrado de proyectos) debe pasar a dar 409 también si el objetivo o proyecto tiene ideas; hoy la base les hace SET NULL en silencio porque el módulo idea no existe.
7. **Eventos y Recordatorios**: citas y avisos (primero dentro de la app).
8. **Frontend React**: agenda del día primero, luego el resto.
9. **Calendario**: vistas mensual y semanal (librería, no a mano).
