package com.agoals.usuario;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.convention.TestBean;

import java.time.Clock;
import java.time.Instant;

/**
 * Base de los tests de integración de L2 que necesitan mover el reloj (gracia del remember-me y desbloqueo del freno).
 * Comparten UN contexto de Spring (la misma configuración) con el pool de conexiones reducido: cada contexto cacheado
 * reserva 10 conexiones de Hikari y Postgres admite 100, con el resto de la suite ya cerca del límite.
 * El reloj es estático y solo avanza: cada test usa sus propios usuarios, IPs y series, así que no se pisan.
 */
@SpringBootTest(properties = { "spring.datasource.hikari.maximum-pool-size=3", "spring.datasource.hikari.minimum-idle=1" })
@AutoConfigureMockMvc
abstract class BaseConRelojMovible {

	static final RelojMovible RELOJ = new RelojMovible(Instant.now());

	@TestBean(methodName = "reloj")
	Clock clock;

	static Clock reloj() {
		return RELOJ;
	}
}
