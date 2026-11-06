# Roadmap por rebanadas

Cada rebanada termina con tests pasando, revisión del diff y un commit.

1. **Arranque**: la app levanta, conecta a PostgreSQL y Flyway aplica `V1`. Test de contexto en verde.
2. **Tarea (CRUD)**: entidad, repository, service, controller, DTOs y tests.
3. **Agenda del día**: listar tareas por fecha, marcar como hecha, posponer (aumenta `veces_pospuesta` y mueve la fecha).
4. **Proyectos y Objetivos**: CRUD con jerarquía, estados y relación con tareas, verificar que tareas con fecha pasada y sin terminar sean visibles,  y que se puedan desmarcar tareas puestas como hechas por error.
5. **Recomendación**: endpoint que sugiere tareas de proyecto pendientes y sin fecha, ordenadas por prioridad.
6. **Ideas**: libres o ligadas a proyecto/objetivo, estado y conclusión.
7. **Eventos y Recordatorios**: citas y avisos (primero dentro de la app).
8. **Frontend React**: agenda del día primero, luego el resto.
9. **Calendario**: vistas mensual y semanal (librería, no a mano).
