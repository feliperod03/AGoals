-- V4: tokens de "recordarme" (remember-me persistente, L2). Tabla y columnas que espera JdbcTokenRepositoryImpl
-- (Spring Security 7.1.2). Sin entidad JPA: Hibernate (validate) solo valida las tablas mapeadas.
-- username guarda el EMAIL del usuario (es el username de Spring Security), por eso 255 y no el 64 del ejemplo.
-- FK al email (UNIQUE en V1): borrar el usuario borra sus tokens, y cambiarle el email los arrastra.
CREATE TABLE persistent_logins (
    series    VARCHAR(64)  PRIMARY KEY,
    username  VARCHAR(255) NOT NULL REFERENCES usuario(email) ON DELETE CASCADE ON UPDATE CASCADE,
    token     VARCHAR(64)  NOT NULL,
    last_used TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_persistent_logins_username ON persistent_logins (username);
