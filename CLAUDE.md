# AGoals

App personal de agenda multifuncional: agenda diaria, calendario, objetivos, proyectos, ideas, centralizado.
Proyecto de uso propio y de aprendizaje de desarrollo con agentes. Prioridad: que quede usable y entendible, no completo.

## Stack
- Java 21, Spring Boot 4.1.x (Maven, wrapper `mvnw`), Spring Web MVC, Spring Data JPA, Validation
- Seguridad (instalada en L1b): `spring-boot-starter-security` y `spring-boot-starter-security-test` (test). Cualquier otra dependencia de backend requiere consultarla antes con Felipe.
- PostgreSQL 16 en Docker Compose, migraciones con Flyway
- Frontend: Vite + React + TypeScript (strict) en `frontend/`, separado del backend. Decisiones de diseño en `docs/frontend-diseno.md`. Tailwind v4 + shadcn/ui, TanStack Query, React Router, date-fns. TypeScript fijado en 6.x (`typescript-eslint` aún no soporta 7).
- Spring Boot 4 cambió paquetes y starters respecto a Boot 3: ante la duda, consulta la documentación de esta versión y no asumas APIs de Boot 3.

## Comandos
- Base de datos: `docker compose up -d` (parar: `docker compose down`)
- Correr la app: `./mvnw spring-boot:run` (en PowerShell: `.\mvnw spring-boot:run`). Con login hace falta la contraseña inicial del usuario 1; la primera vez se fija desde una variable de entorno (ver "Autenticación y multiusuario"):
  `$env:AGOALS_CLAVE_INICIAL = 'tu-contraseña'; .\mvnw spring-boot:run` (opcional: `$env:AGOALS_EMAIL_INICIAL = 'tu@correo.com'`; sin ella el email del usuario 1 es `yo@agoals.local`).
- Tests: `./mvnw test` (los que cargan el contexto de Spring necesitan la base de datos levantada). Ojo: con `AGOALS_CLAVE_INICIAL` puesta en la consola, `mvnw test` también fija la contraseña del usuario 1 en la base (es idempotente y nunca pisa un hash real).
- Prueba de humo de la API: `.\scripts\smoke-test.ps1` con la app corriendo. Entra con `-Email`/`-Clave` o, si no se pasan, con `AGOALS_EMAIL_INICIAL` (por defecto `yo@agoals.local`) y `AGOALS_CLAVE_INICIAL`; sin contraseña sale con error.

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
- Eventos recurrentes: `features/eventos/` tiene `RepetirCampos`, `RecordatorioSerieCampo`, `ElegirAlcance` y `formularioSerie.ts` (copia del generador de ocurrencias del backend: si cambia la regla allí, cambiar las dos); la API vive en `api/series.ts` y los tipos en `types/serie.ts`.
- Colores solo con los tokens de `src/index.css` (`bg-card`, `text-mut`, ...), nunca hex sueltos.
- Cada funcionalidad nueva lleva tests (Vitest + Testing Library).
- **Lista cerrada de dependencias.** Cualquier otra requiere consultarla antes con Felipe.
  - Aplicación: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `date-fns`, `tailwindcss`, `@tailwindcss/vite`, `@fontsource/fraunces`, `@fontsource/inter`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@radix-ui/react-slot`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `react-hook-form`, `tw-animate-css`.
  - Desarrollo: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`.
  - Aprobadas pero aún sin instalar: `zod` (solo si hace falta).
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
├── serie        (series de eventos recurrentes; orquesta evento y recordatorio)
└── usuario      (cuenta, login y sesión: entidad, repository, UsuarioService, SesionService, AuthController, SeguridadConfig y UsuarioActualDeSesion)
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
- `proyecto ↔ objetivo` sería circular (Proyecto valida que su `objetivoId` exista; Objetivo necesita saber si tiene proyectos para el 409 al borrar). Se resuelve con `ObjetivoConsultaService`: un service de solo lectura (`validarExiste`) que usa únicamente `ObjetivoRepository` y `UsuarioActual`. Así `ProyectoService → ObjetivoConsultaService` y `ObjetivoService → ProyectoService`, sin ciclo.
- `serie → evento` y `serie → recordatorio`: `SerieEventoService` orquesta a `EventoService` y `RecordatorioService`; evento y recordatorio NO conocen a serie (la migración V3 ya está aplicada: no editarla).
- Las comprobaciones de jerarquía (padre existente, sin ciclos) están en `common.Jerarquia`; cada módulo pasa cómo buscar y qué excepción lanzar.

## Autenticación y multiusuario (decidido el 17/11)
- Objetivo: varios usuarios (conocidos de Felipe y, quizá, un despliegue público), cada uno con sus datos aislados.
- Sesión de Spring Security con cookie HttpOnly (sin JWT) y CSRF activado (token en cookie, cabecera en cada escritura). En producción el frontend y `/api` van bajo el mismo dominio (rewrite), así que sigue sin hacer falta CORS.
- El usuario actual sale de un componente `UsuarioActual` (nunca de un id fijo). Desde L1b la implementación es `usuario.UsuarioActualDeSesion`, que lee el principal (`UsuarioAutenticado`, con el id) de la sesión; si no hay usuario lanza `UsuarioNoAutenticadoException` (el filtro responde 401 antes). Los demás módulos dependen solo de la interfaz de `common`. Toda consulta y escritura filtra por ese id; un recurso de otro usuario responde 404, igual que uno inexistente.
- Endpoints (L1b): `POST /api/auth/login` `{email, clave}` → 200 `{id, nombreUsuario, email}` (el id de sesión cambia); `POST /api/auth/logout` → 204; `GET /api/auth/yo` → usuario o 401; `GET /api/auth/csrf` → 204 y deja la cookie `XSRF-TOKEN`. Todo el resto de `/api/**` exige sesión: sin ella, 401 en JSON; CSRF ausente o inválido, 403 en JSON. El login es solo por email (sin distinguir mayúsculas ni espacios en los bordes); mismo mensaje si falla la contraseña o el email no existe.
- CSRF para la SPA (lo usa F1): antes de loguearse, `GET /api/auth/csrf`; leer la cookie `XSRF-TOKEN` y mandarla en la cabecera `X-XSRF-TOKEN` en cada POST/PUT/PATCH/DELETE, incluido el login y el logout. El login y el logout renuevan la cookie: releerla después de cada uno.
- Contraseñas con el `PasswordEncoder` delegado de Spring (BCrypt, hash `{bcrypt}...`). Al arrancar, si `AGOALS_CLAVE_INICIAL` está definida y el usuario 1 aún tiene el hash `sin-login-v1` de V2, se guarda el hash de esa contraseña (y, si está `AGOALS_EMAIL_INICIAL`, ese email recortado y en minúsculas). Nunca pisa un hash real; sin la variable la app arranca igual y avisa en el log. Nunca se loguean contraseñas.
- Cookie de sesión `AGOALS_SESION`: HttpOnly y SameSite=Lax. Secure se configura con `agoals.seguridad.cookie-segura` (variable `AGOALS_COOKIE_SEGURA`; false en desarrollo, true en producción) y afecta también a `XSRF-TOKEN`.
- Tests: los `@WebMvcTest` usan `@AutoConfigureMockMvc(addFilters = false)` (los filtros se prueban en `SeguridadIntegracionTest`, contra Postgres, sin mocks de `UsuarioActual`). Los tests de services con rollback importan `UsuarioActualFijoDePrueba` (siempre el usuario 1, solo en `src/test`).
- Rebanadas: L1a `UsuarioActual` y aislamiento (hecha) → L1b login backend (hecha) → L2 sesión persistente y freno de intentos → F1 login en el frontend (hasta entonces la interfaz recibe 401) → más adelante, altas de usuarios por invitación.

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
Microservicios, tareas y recordatorios sueltos recurrentes (los eventos recurrentes ya están hechos), registro abierto al público y recuperación de contraseña por correo (el login y el multiusuario sí entran; ver "Autenticación y multiusuario"), vista anual del calendario, notificaciones por correo (empezar con notificación dentro de la app).
