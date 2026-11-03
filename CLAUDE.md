# AGoals

App personal de agenda multifuncional: agenda diaria, calendario, objetivos, proyectos, ideas y notas, centralizado.
Proyecto de uso propio y de aprendizaje de desarrollo con agentes. Prioridad: que quede usable y entendible, no completo.

## Stack
- Java 21, Spring Boot 4.1.x (Maven, wrapper `mvnw`), Spring Web MVC, Spring Data JPA, Validation
- PostgreSQL 16 en Docker Compose, migraciones con Flyway
- Frontend (más adelante): React, en una carpeta `frontend/` separada
- Spring Boot 4 cambió paquetes y starters respecto a Boot 3: ante la duda, consulta la documentación de esta versión y no asumas APIs de Boot 3.

## Comandos
- Base de datos: `docker compose up -d` (parar: `docker compose down`)
- Correr la app: `./mvnw spring-boot:run` (en PowerShell: `.\mvnw spring-boot:run`)
- Tests: `./mvnw test` (los que cargan el contexto de Spring necesitan la base de datos levantada)

## Arquitectura
Monolito modular, organizado por dominio y con capas dentro de cada módulo:

```
com.agoals
├── tarea        (entidad, repository, service, controller, dto)
├── proyecto
├── objetivo
├── idea
├── evento
├── recordatorio
└── usuario
```

Reglas:
1. Dependencias en un solo sentido: controller → service → repository. Nunca al revés.
2. Un módulo no usa el repository de otro; pasa por su service.
3. Los controllers reciben y devuelven DTOs, nunca entidades JPA.
4. La lógica de negocio vive en los services. Los controllers solo validan formato y delegan.
5. El esquema se cambia SOLO con migraciones Flyway nuevas (`V2__...sql`, `V3__...sql`). Nunca editar una migración ya aplicada.
6. Hibernate está en `ddl-auto=validate`: las entidades deben coincidir con el esquema.

## Modelo de datos
Ver `docs/modelo-datos.md` (entidades, relaciones, enums y reglas) y la migración `src/main/resources/db/migration/V1__esquema_inicial.sql`.
Resumen de la idea central: una sola entidad `Tarea` cubre actividad de agenda, paso de proyecto y subobjetivo.
- `fecha` NULL = tarea sin agendar (de ahí sale la "recomendación" de proyectos)
- `fecha` sin horas = lista del día; `fecha` + `hora_inicio/hora_fin` = planificación por horas

## Convenciones
- Nombres del dominio en español (Tarea, Proyecto, Objetivo, Idea, Evento, Recordatorio); código técnico en inglés (Controller, Service, Repository).
- Enums de Java persistidos como texto: `@Enumerated(EnumType.STRING)`.
- Fechas: `LocalDate`/`LocalTime` para tareas; `OffsetDateTime`/`Instant` para eventos y recordatorios.
- Entidades JPA con constructor vacío y `equals/hashCode` basados en el id; sin `@Data` en entidades.
- Cada funcionalidad nueva lleva tests (service y controller como mínimo).

## Forma de trabajar (importante)
- Siempre propón un plan corto antes de escribir código y espera confirmación.
- Trabaja por rebanadas pequeñas (ver `docs/roadmap.md`): una rebanada por vez, con tests, y avisa cuando esté lista para revisar.
- No agregues dependencias ni cambies la arquitectura sin preguntar.
- Explica brevemente las decisiones no obvias: el objetivo del proyecto incluye aprender.
- Un commit por rebanada, mensaje claro en español.

## Fuera de alcance en la v1
Microservicios, eventos recurrentes, login/autenticación, vista anual del calendario, notificaciones por correo (empezar con notificación dentro de la app).
