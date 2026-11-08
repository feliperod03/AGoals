# AGoals

App personal de agenda multifuncional: agenda diaria, calendario, objetivos, proyectos, ideas, centralizado.
Proyecto de uso propio y de aprendizaje de desarrollo con agentes. Prioridad: que quede usable y entendible, no completo.

## Stack
- Java 21, Spring Boot 4.1.x (Maven, wrapper `mvnw`), Spring Web MVC, Spring Data JPA, Validation
- PostgreSQL 16 en Docker Compose, migraciones con Flyway
- Frontend: Vite + React + TypeScript (strict) en `frontend/`, separado del backend. Decisiones de diseño en `docs/frontend-diseno.md`. Tailwind v4 + shadcn/ui, TanStack Query, React Router, date-fns. TypeScript fijado en 6.x (`typescript-eslint` aún no soporta 7).
- Spring Boot 4 cambió paquetes y starters respecto a Boot 3: ante la duda, consulta la documentación de esta versión y no asumas APIs de Boot 3.

## Comandos
- Base de datos: `docker compose up -d` (parar: `docker compose down`)
- Correr la app: `./mvnw spring-boot:run` (en PowerShell: `.\mvnw spring-boot:run`)
- Tests: `./mvnw test` (los que cargan el contexto de Spring necesitan la base de datos levantada)

### Frontend (desde `frontend/`)
- Instalar: `npm install`
- Desarrollo: `npm run dev` (http://localhost:5173; el proxy de Vite manda `/api` a `http://localhost:8080`, así que hay que tener el backend y la base levantados)
- Tests: `npm test` (Vitest; `npm run test:watch` para modo continuo). La zona horaria de los tests se fija en `vitest.config.ts` (Buenos Aires)
- Build (incluye el chequeo de tipos con `tsc`): `npm run build`
- Lint: `npm run lint`

## Frontend: convenciones
- Capas: componentes → hooks de `features/` → `api/`. Solo `api/` llama a `fetch`.
- Todo el manejo de fechas va en `src/lib/fechas.ts` (con tests). Nunca `toISOString()`: da UTC y desplaza el día.
- Idioma: interfaz en español. Código en inglés para lo técnico/genérico (`Button`, `ApiError`, `useTema`, `formatDate`) y en español para el dominio y lo que viene de la API (`Tarea`, `useAgendaDelDia`, `fechaHoraInicio`).
- Colores solo con los tokens de `src/index.css` (`bg-card`, `text-mut`, ...), nunca hex sueltos.
- Cada funcionalidad nueva lleva tests (Vitest + Testing Library).
- **Lista cerrada de dependencias.** Cualquier otra requiere consultarla antes con Felipe.
  - Aplicación: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `date-fns`, `tailwindcss`, `@tailwindcss/vite`, `@fontsource/fraunces`, `@fontsource/inter`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `tw-animate-css`.
  - Desarrollo: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`.
  - Aprobadas pero aún sin instalar: `react-hook-form` (rebanada 8.2; `zod` solo si hace falta).
  - Descartadas: Next.js, Redux/Zustand, MUI/Ant, axios, generar tipos desde OpenAPI.

## Arquitectura (backend)
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

Dependencias entre módulos (en un solo sentido, sin ciclos de beans):
- `proyecto → tarea`: `TareaService` no conoce a `ProyectoService`; los métodos de tarea para proyecto/objetivo no validan que existan, lo hace quien llama.
- `proyecto ↔ objetivo` sería circular (Proyecto valida que su `objetivoId` exista; Objetivo necesita saber si tiene proyectos para el 409 al borrar). Se resuelve con `ObjetivoConsultaService`: un service de solo lectura (`validarExiste`) que usa únicamente `ObjetivoRepository`. Así `ProyectoService → ObjetivoConsultaService` y `ObjetivoService → ProyectoService`, sin ciclo.
- Las comprobaciones de jerarquía (padre existente, sin ciclos) están en `common.Jerarquia`; cada módulo pasa cómo buscar y qué excepción lanzar.

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
