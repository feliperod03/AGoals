-- =====================================================================
-- Series de eventos recurrentes (opción A: la serie guarda la regla y
-- los eventos se MATERIALIZAN como filas reales de `evento`).
--
--   serie_evento.dias_semana: texto 'LUNES,MIERCOLES' (solo SEMANAL)
--   evento.serie_id: NULL = evento suelto
--
-- Borrado (ON DELETE):
--   usuario -> serie_evento: CASCADE
--   serie_evento -> evento.serie_id: SET NULL (los eventos no se pierden)
-- =====================================================================

CREATE TABLE serie_evento (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id         BIGINT      NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    frecuencia         VARCHAR(10) NOT NULL CHECK (frecuencia IN ('SEMANAL','MENSUAL')),
    dias_semana        VARCHAR(80),
    intervalo_semanas  SMALLINT,
    dia_mes            SMALLINT,
    fecha_inicio       DATE        NOT NULL,
    hasta              DATE,
    repeticiones       INTEGER,
    zona_horaria       VARCHAR(50) NOT NULL,
    CHECK ((frecuencia = 'SEMANAL' AND dias_semana IS NOT NULL AND intervalo_semanas IN (1, 2) AND dia_mes IS NULL)
        OR (frecuencia = 'MENSUAL' AND dia_mes BETWEEN 1 AND 31 AND dias_semana IS NULL AND intervalo_semanas IS NULL)),
    CHECK ((hasta IS NULL) <> (repeticiones IS NULL)),
    CHECK (repeticiones IS NULL OR repeticiones BETWEEN 1 AND 260),
    CHECK (hasta IS NULL OR hasta >= fecha_inicio)
);

ALTER TABLE evento
    ADD COLUMN serie_id BIGINT REFERENCES serie_evento(id) ON DELETE SET NULL;

CREATE INDEX idx_serie_evento_usuario ON serie_evento (usuario_id);

-- Para "esta y las siguientes": no pesa sobre los eventos sueltos.
CREATE INDEX idx_evento_serie ON evento (serie_id, fecha_hora_inicio)
    WHERE serie_id IS NOT NULL;
