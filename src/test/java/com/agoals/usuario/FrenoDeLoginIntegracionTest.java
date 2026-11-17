package com.agoals.usuario;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Freno de intentos de login (L2) de punta a punta contra el PostgreSQL real. El freno es un bean compartido por el
 * contexto: cada test usa su propia IP (rangos de documentación 198.51.100.0/24 y 203.0.113.0/24) y emails ZZ-l2-
 * únicos, así que no se contaminan entre sí ni con otros tests. El reloj es movible para probar el desbloqueo.
 */
class FrenoDeLoginIntegracionTest extends BaseConRelojMovible {

	private static final String CLAVE = "clave-de-prueba-123";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	PasswordEncoder encoder;

	private final String hex = UUID.randomUUID().toString().substring(0, 8);
	private final List<Long> creados = new ArrayList<>();

	@AfterEach
	void limpiar() {
		for (Long id : creados) {
			jdbc.update("DELETE FROM usuario WHERE id = ?", id);
		}
		assertThat(jdbc.queryForObject("SELECT count(*) FROM usuario WHERE nombre_usuario LIKE 'ZZ-l2%'", Integer.class))
				.isZero();
	}

	private String nuevoUsuario(String letra) {
		String email = "zz-l2-f" + letra + "-" + hex + "@agoals.local";
		creados.add(jdbc.queryForObject(
				"INSERT INTO usuario (nombre_usuario, email, contrasena_hash) VALUES (?, ?, ?) RETURNING id", Long.class,
				"ZZ-l2-f" + letra + "-" + hex, email, encoder.encode(CLAVE)));
		return email;
	}

	private MvcResult login(String ip, String email, String clave) throws Exception {
		Cookie xsrf = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN");
		return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"clave\":\"" + clave + "\"}").cookie(xsrf)
				.header("X-XSRF-TOKEN", xsrf.getValue()).with(req -> {
					req.setRemoteAddr(ip);
					return req;
				})).andReturn();
	}

	private void fallar(String ip, String email, int veces) throws Exception {
		for (int i = 0; i < veces; i++) {
			assertThat(login(ip, email, "mala-" + i).getResponse().getStatus()).as("fallo " + (i + 1)).isEqualTo(401);
		}
	}

	@Test
	void trasCincoFallosElSextoIntentoDa429AunqueLaClaveSeaCorrectaYSinCrearSesion() throws Exception {
		String email = nuevoUsuario("a");
		fallar("198.51.100.11", email, 5);

		MvcResult r = login("198.51.100.11", email, CLAVE);

		assertThat(r.getResponse().getStatus()).isEqualTo(429);
		assertThat(r.getResponse().getContentType()).contains("json");
		assertThat(r.getResponse().getHeader("Retry-After")).isEqualTo("900");
		String mensaje = JsonPath.read(r.getResponse().getContentAsString(StandardCharsets.UTF_8), "$.mensaje");
		assertThat(mensaje).isEqualTo("Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentarlo.");
		assertThat(r.getRequest().getSession(false)).isNull();
	}

	@Test
	void alPasarElBloqueoElLoginVuelveAFuncionar() throws Exception {
		String email = nuevoUsuario("a");
		fallar("198.51.100.12", email, 5);
		assertThat(login("198.51.100.12", email, CLAVE).getResponse().getStatus()).isEqualTo(429);

		RELOJ.avanzar(Duration.ofMinutes(15).plusSeconds(1));

		assertThat(login("198.51.100.12", email, CLAVE).getResponse().getStatus()).isEqualTo(200);
	}

	@Test
	void unFalloDeOtroParNoBloqueaAlUsuario() throws Exception {
		String a = nuevoUsuario("a");
		String b = nuevoUsuario("b");
		fallar("198.51.100.13", a, 5);

		// Otro email desde la misma IP, y el mismo email desde otra IP, siguen entrando.
		assertThat(login("198.51.100.13", b, CLAVE).getResponse().getStatus()).isEqualTo(200);
		assertThat(login("203.0.113.13", a, CLAVE).getResponse().getStatus()).isEqualTo(200);
	}

	@Test
	void unLoginCorrectoReiniciaElContadorDelPar() throws Exception {
		String email = nuevoUsuario("a");
		fallar("198.51.100.14", email, 4);
		assertThat(login("198.51.100.14", email, CLAVE).getResponse().getStatus()).isEqualTo(200);

		fallar("198.51.100.14", email, 4);

		assertThat(login("198.51.100.14", email, CLAVE).getResponse().getStatus()).as("todavía sin bloqueo").isEqualTo(200);
	}

	@Test
	void veinteFallosDeUnaIpConEmailsDistintosBloqueanLaIp() throws Exception {
		String real = nuevoUsuario("a");
		for (int i = 0; i < 20; i++) {
			assertThat(login("198.51.100.15", "zz-l2-nadie-" + i + "-" + hex + "@agoals.local", "mala").getResponse().getStatus())
					.isEqualTo(401);
		}

		assertThat(login("198.51.100.15", real, CLAVE).getResponse().getStatus()).isEqualTo(429);
		assertThat(login("203.0.113.15", real, CLAVE).getResponse().getStatus()).as("otra IP no se afecta").isEqualTo(200);
	}
}
