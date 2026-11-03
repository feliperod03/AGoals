-- =====================================================================
-- Esquema inicial: app de agenda personal
-- PostgreSQL 15+. Pensado para Flyway:
--   src/main/resources/db/migration/V1__esquema_inicial.sql
--
-- Enums (en Java: @Enumerated(EnumType.STRING), guardados como texto):
--   Prioridad:  BAJA | MEDIA | ALTA
--   Estado:     PENDIENTE | EN_PROGRESO | EN_PAUSA | CANCELADO | HECHO
--   EstadoIdea: PLANTEADA | CONCLUIDA
--   Canal:      APP | CORREO
--
-- Borrado (ON DELETE):
--   usuario -> todo lo suyo: CASCADE
--   padre_id (jerarquías): CASCADE (se va el subárbol)
--   vínculos a proyecto/objetivo: SET NULL (no se pierde el contenido)
-- =====================================================================

CREATE TABLE usuario (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_usuario   VARCHAR(50)  NOT NULL UNIQUE,
    email            VARCHAR(255) NOT NULL UNIQUE,
    contrasena_hash  VARCHAR(255) NOT NULL,   -- nunca la contraseña en claro (BCrypt)
    zona_horaria     VARCHAR(50)  NOT NULL DEFAULT 'America/Argentina/Buenos_Aires'
);

-- ---------------------------------------------------------------------
-- Objetivo (jerárquico: un objetivo puede tener subobjetivos)
-- ---------------------------------------------------------------------
CREATE TABLE objetivo (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      BIGINT       NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    padre_id        BIGINT       REFERENCES objetivo(id) ON DELETE CASCADE,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     TEXT         NOT NULL DEFAULT '',
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                    CHECK (estado IN ('PENDIENTE','EN_PROGRESO','EN_PAUSA','CANCELADO','HECHO')),
    prioridad       VARCHAR(10)
                    CHECK (prioridad IN ('BAJA','MEDIA','ALTA')),
    fecha_creacion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (padre_id <> id)
);

-- ---------------------------------------------------------------------
-- Proyecto (jerárquico; pertenece como máximo a un objetivo)
-- ---------------------------------------------------------------------
CREATE TABLE proyecto (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      BIGINT       NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    padre_id        BIGINT       REFERENCES proyecto(id) ON DELETE CASCADE,
    objetivo_id     BIGINT       REFERENCES objetivo(id) ON DELETE SET NULL,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     TEXT         NOT NULL DEFAULT '',
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                    CHECK (estado IN ('PENDIENTE','EN_PROGRESO','EN_PAUSA','CANCELADO','HECHO')),
    prioridad       VARCHAR(10)
                    CHECK (prioridad IN ('BAJA','MEDIA','ALTA')),
    fecha_creacion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (padre_id <> id)
);

-- ---------------------------------------------------------------------
-- Tarea (jerárquica). Cubre: actividad de agenda, paso de proyecto y
-- subobjetivo.
--   fecha NULL            -> tarea suelta / pendiente sin agendar
--   fecha + horas NULL    -> lista del día
--   fecha + horas         -> planificación por horas
-- ---------------------------------------------------------------------
CREATE TABLE tarea (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id       BIGINT       NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    padre_id         BIGINT       REFERENCES tarea(id) ON DELETE CASCADE,
    proyecto_id      BIGINT       REFERENCES proyecto(id) ON DELETE SET NULL,
    objetivo_id      BIGINT       REFERENCES objetivo(id) ON DELETE SET NULL,
    titulo           VARCHAR(200) NOT NULL,
    descripcion      TEXT,
    estado           VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (estado IN ('PENDIENTE','EN_PROGRESO','EN_PAUSA','CANCELADO','HECHO')),
    prioridad        VARCHAR(10)
                     CHECK (prioridad IN ('BAJA','MEDIA','ALTA')),
    fecha            DATE,
    hora_inicio      TIME,
    hora_fin         TIME,
    veces_pospuesta  INTEGER      NOT NULL DEFAULT 0 CHECK (veces_pospuesta >= 0),
    fecha_creacion   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (padre_id <> id),
    CHECK (hora_inicio IS NULL OR fecha IS NOT NULL),          -- horas exigen fecha
    CHECK (hora_fin IS NULL OR hora_inicio IS NOT NULL),       -- fin exige inicio
    CHECK (hora_fin IS NULL OR hora_fin > hora_inicio)
);

-- ---------------------------------------------------------------------
-- Idea (libre, o ligada a un proyecto o a un objetivo, no a ambos)
-- ---------------------------------------------------------------------
CREATE TABLE idea (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      BIGINT       NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    proyecto_id     BIGINT       REFERENCES proyecto(id) ON DELETE SET NULL,
    objetivo_id     BIGINT       REFERENCES objetivo(id) ON DELETE SET NULL,
    titulo          VARCHAR(200) NOT NULL,
    descripcion     TEXT         NOT NULL DEFAULT '',
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PLANTEADA'
                    CHECK (estado IN ('PLANTEADA','CONCLUIDA')),
    conclusion      TEXT,
    fecha_creacion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    fecha_cierre    TIMESTAMPTZ,
    CHECK (proyecto_id IS NULL OR objetivo_id IS NULL)
);

-- ---------------------------------------------------------------------
-- Evento (cita o compromiso)
-- ---------------------------------------------------------------------
CREATE TABLE evento (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id         BIGINT       NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    titulo             VARCHAR(200) NOT NULL,
    descripcion        TEXT         NOT NULL DEFAULT '',
    fecha_hora_inicio  TIMESTAMPTZ  NOT NULL,
    fecha_hora_fin     TIMESTAMPTZ  NOT NULL,
    prioridad          VARCHAR(10)
                       CHECK (prioridad IN ('BAJA','MEDIA','ALTA')),
    CHECK (fecha_hora_fin > fecha_hora_inicio)
);

-- ---------------------------------------------------------------------
-- Recordatorio: de una tarea, de un evento, o suelto (con descripcion).
-- UNIQUE en tarea_id/evento_id = máximo un recordatorio por cada uno
-- (cardinalidad 0..1 del diagrama). Postgres permite varios NULL.
-- ---------------------------------------------------------------------
CREATE TABLE recordatorio (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id   BIGINT      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    tarea_id     BIGINT      UNIQUE REFERENCES tarea(id)  ON DELETE CASCADE,
    evento_id    BIGINT      UNIQUE REFERENCES evento(id) ON DELETE CASCADE,
    fecha_hora   TIMESTAMPTZ NOT NULL,
    canal        VARCHAR(10) NOT NULL DEFAULT 'APP'
                 CHECK (canal IN ('APP','CORREO')),
    enviado      BOOLEAN     NOT NULL DEFAULT FALSE,
    descripcion  TEXT        NOT NULL DEFAULT '',
    CHECK (tarea_id IS NULL OR evento_id IS NULL)
);

-- ---------------------------------------------------------------------
-- Índices (las claves foráneas no se indexan solas en PostgreSQL)
-- ---------------------------------------------------------------------
CREATE INDEX idx_objetivo_usuario     ON objetivo (usuario_id);
CREATE INDEX idx_objetivo_padre       ON objetivo (padre_id);

CREATE INDEX idx_proyecto_usuario     ON proyecto (usuario_id);
CREATE INDEX idx_proyecto_padre       ON proyecto (padre_id);
CREATE INDEX idx_proyecto_objetivo    ON proyecto (objetivo_id);

CREATE INDEX idx_tarea_usuario_fecha  ON tarea (usuario_id, fecha);
CREATE INDEX idx_tarea_padre          ON tarea (padre_id);
CREATE INDEX idx_tarea_proyecto       ON tarea (proyecto_id);
CREATE INDEX idx_tarea_objetivo       ON tarea (objetivo_id);
-- Para el botón "recomendación": pendientes de proyecto sin agendar
CREATE INDEX idx_tarea_recomendacion  ON tarea (usuario_id, proyecto_id)
    WHERE fecha IS NULL AND estado IN ('PENDIENTE','EN_PROGRESO');

CREATE INDEX idx_idea_usuario         ON idea (usuario_id);
CREATE INDEX idx_idea_proyecto        ON idea (proyecto_id);
CREATE INDEX idx_idea_objetivo        ON idea (objetivo_id);

CREATE INDEX idx_evento_usuario_inicio ON evento (usuario_id, fecha_hora_inicio);

-- Para el scheduler de notificaciones: pendientes de enviar
CREATE INDEX idx_recordatorio_pendientes ON recordatorio (fecha_hora)
    WHERE enviado = FALSE;
CREATE INDEX idx_recordatorio_usuario ON recordatorio (usuario_id);
