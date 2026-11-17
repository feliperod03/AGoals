package com.agoals.usuario;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Seguridad de punta a punta (L1b) contra el PostgreSQL real, con los filtros de Spring Security y sin mocks de
 * UsuarioActual. Crea usuarios ZZ-l1b-... con JdbcTemplate y los borra por id al terminar (cascada); nunca toca al
 * usuario 1. MockMvc no guarda cookies: el test hace de navegador (lleva la sesión y la cookie XSRF-TOKEN a mano).
 * Límite: MockMvc no emite la cookie de sesión (la pone el contenedor), así que HttpOnly/SameSite de AGOALS_SESION se
 * verifican en el smoke con la app real.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SeguridadIntegracionTest {

	private static final String CLAVE = "clave-de-prueba-123";
	private static final String MENSAJE_LOGIN = "Email o contraseña incorrectos";

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
		assertThat(jdbc.queryForObject("SELECT count(*) FROM usuario WHERE nombre_usuario LIKE 'ZZ-l1b%'", Integer.class))
				.isZero();
		for (Long id : creados) {
			assertThat(jdbc.queryForObject("SELECT count(*) FROM tarea WHERE usuario_id = ?", Integer.class, id)).isZero();
		}
	}

	// ---------------------------------------------------------------- helpers

	private String emailDe(String letra) {
		return "zz-l1b-" + letra + "-" + hex + "@agoals.local";
	}

	private String nuevoUsuario(String letra, String hash) {
		String email = emailDe(letra);
		creados.add(jdbc.queryForObject(
				"INSERT INTO usuario (nombre_usuario, email, contrasena_hash) VALUES (?, ?, ?) RETURNING id", Long.class,
				"ZZ-l1b-" + letra + "-" + hex, email, hash));
		return email;
	}

	private String nuevoUsuarioConClave(String letra) {
		return nuevoUsuario(letra, encoder.encode(CLAVE));
	}

	/** Lo que hace la SPA antes de cualquier escritura: pedir la cookie XSRF-TOKEN. */
	private Cookie pedirCsrf() throws Exception {
		MvcResult r = mvc.perform(get("/api/auth/csrf")).andExpect(status().isNoContent()).andReturn();
		return ultimaCookieXsrf(r);
	}

	/** En el login Spring borra el token viejo (cookie vacía) y luego manda el nuevo: el navegador se queda con la última. */
	private static Cookie ultimaCookieXsrf(MvcResult r) {
		Cookie ultima = null;
		for (Cookie c : r.getResponse().getCookies()) {
			if (c.getName().equals("XSRF-TOKEN")) {
				ultima = c;
			}
		}
		assertThat(ultima).isNotNull();
		assertThat(ultima.getValue()).isNotEmpty();
		return ultima;
	}

	private static MockHttpServletRequestBuilder conCsrf(MockHttpServletRequestBuilder b, Cookie xsrf) {
		return b.cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
	}

	private static String cuerpo(MvcResult r) throws Exception {
		return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private MvcResult intentarLogin(String email, String clave, MockHttpSession sesionPrevia, Cookie xsrf) throws Exception {
		MockHttpServletRequestBuilder b = post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"clave\":\"" + clave + "\"}");
		if (sesionPrevia != null) {
			// El contenedor real marca como válido el id que manda el navegador; MockMvc no, y sin eso la estrategia no actúa.
			b.session(sesionPrevia).with(req -> {
				req.setRequestedSessionId(sesionPrevia.getId());
				return req;
			});
		}
		return mvc.perform(conCsrf(b, xsrf)).andReturn();
	}

	/** Una "pestaña" ya logueada: su sesión y su cookie XSRF-TOKEN actual. */
	private record Navegador(MockHttpSession sesion, Cookie xsrf) {
	}

	private Navegador loguear(String email) throws Exception {
		Cookie xsrf = pedirCsrf();
		MvcResult r = intentarLogin(email, CLAVE, null, xsrf);
		assertThat(r.getResponse().getStatus()).as("login: " + cuerpo(r)).isEqualTo(200);
		MockHttpSession sesion = (MockHttpSession) r.getRequest().getSession(false);
		assertThat(sesion).isNotNull();
		return new Navegador(sesion, ultimaCookieXsrf(r));
	}

	private long crearTarea(Navegador n, String titulo) throws Exception {
		MvcResult r = mvc.perform(conCsrf(post("/api/tareas").session(n.sesion()).contentType(MediaType.APPLICATION_JSON)
				.content("{\"titulo\":\"" + titulo + "\",\"fecha\":\"2098-03-10\"}"), n.xsrf())).andReturn();
		assertThat(r.getResponse().getStatus()).as(cuerpo(r)).isEqualTo(201);
		return ((Number) JsonPath.read(cuerpo(r), "$.id")).longValue();
	}

	private List<Number> idsDeTareas(Navegador n) throws Exception {
		MvcResult r = mvc.perform(get("/api/tareas").session(n.sesion())).andReturn();
		assertThat(r.getResponse().getStatus()).isEqualTo(200);
		return JsonPath.read(cuerpo(r), "$..id");
	}

	// ---------------------------------------------------------------- sin sesión

	@Test
	void sinSesionLaApiDa401JsonEnVariosEndpoints() throws Exception {
		for (String url : List.of("/api/tareas", "/api/tareas/agenda?fecha=2098-03-10", "/api/proyectos", "/api/objetivos",
				"/api/ideas", "/api/recordatorios", "/api/series-eventos/1", "/api/auth/yo",
				"/api/eventos?desde=2098-01-01T00:00:00-03:00&hasta=2099-01-01T00:00:00-03:00")) {
			MvcResult r = mvc.perform(get(url)).andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.mensaje").value("Inicia sesión para continuar")).andReturn();
			assertThat(r.getResponse().getHeader("Location")).as(url).isNull();
			assertThat(r.getResponse().getContentType()).as(url).contains("json");
			// Un anónimo no crea sesión (requestCache desactivado).
			assertThat(r.getRequest().getSession(false)).as(url).isNull();
		}
	}

	@Test
	void unaEscrituraConCsrfPeroSinSesionDa401() throws Exception {
		Cookie xsrf = pedirCsrf();

		mvc.perform(conCsrf(post("/api/tareas").contentType(MediaType.APPLICATION_JSON).content("{\"titulo\":\"x\"}"), xsrf))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void elEndpointDeCsrfEntregaLaCookieLegiblePorJs() throws Exception {
		MvcResult r = mvc.perform(get("/api/auth/csrf")).andExpect(status().isNoContent()).andReturn();

		Cookie c = ultimaCookieXsrf(r);
		assertThat(c.isHttpOnly()).isFalse();
		// MockMvc no pinta SameSite en el encabezado, pero sí lo guarda como atributo de la cookie.
		assertThat(c.getAttribute("SameSite")).isEqualTo("Lax");
	}

	// ---------------------------------------------------------------- login

	@Test
	void loginCorrectoDevuelveElUsuarioYCreaLaSesion() throws Exception {
		String email = nuevoUsuarioConClave("a");
		Cookie xsrf = pedirCsrf();

		MvcResult r = intentarLogin(email, CLAVE, null, xsrf);

		assertThat(r.getResponse().getStatus()).isEqualTo(200);
		assertThat((String) JsonPath.read(cuerpo(r), "$.email")).isEqualTo(email);
		assertThat((String) JsonPath.read(cuerpo(r), "$.nombreUsuario")).isEqualTo("ZZ-l1b-a-" + hex);
		assertThat(cuerpo(r)).doesNotContain("hash").doesNotContain("bcrypt").doesNotContain(CLAVE);
		MockHttpSession sesion = (MockHttpSession) r.getRequest().getSession(false);
		assertThat(sesion).isNotNull();
		// La sesión sirve para entrar: /yo responde con el mismo usuario.
		mvc.perform(get("/api/auth/yo").session(sesion)).andExpect(status().isOk())
				.andExpect(jsonPath("$.email").value(email));
	}

	@Test
	void loginCambiaElIdDeSesion() throws Exception {
		String email = nuevoUsuarioConClave("a");
		MockHttpSession previa = new MockHttpSession();
		String antes = previa.getId();

		MvcResult r = intentarLogin(email, CLAVE, previa, pedirCsrf());

		assertThat(r.getResponse().getStatus()).isEqualTo(200);
		assertThat(previa.getId()).isNotEqualTo(antes);
	}

	@Test
	void loginRotaElTokenCsrf() throws Exception {
		String email = nuevoUsuarioConClave("a");
		Cookie antes = pedirCsrf();

		MvcResult r = intentarLogin(email, CLAVE, null, antes);

		Cookie despues = ultimaCookieXsrf(r);
		assertThat(despues.getValue()).isNotEqualTo(antes.getValue());
	}

	@Test
	void claveMalaYEmailInexistenteDan401ConElMismoMensaje() throws Exception {
		String email = nuevoUsuarioConClave("a");
		Cookie xsrf = pedirCsrf();

		MvcResult claveMala = intentarLogin(email, "otra-clave", null, xsrf);
		MvcResult sinEmail = intentarLogin("nadie-" + hex + "@agoals.local", CLAVE, null, xsrf);

		assertThat(claveMala.getResponse().getStatus()).isEqualTo(401);
		assertThat(sinEmail.getResponse().getStatus()).isEqualTo(401);
		assertThat((String) JsonPath.read(cuerpo(claveMala), "$.mensaje")).isEqualTo(MENSAJE_LOGIN);
		assertThat(cuerpo(sinEmail)).isEqualTo(cuerpo(claveMala));
		assertThat(claveMala.getRequest().getSession(false)).isNull();
	}

	@Test
	void unUsuarioSinContrasenaOConHashSinFormatoDa401NoUn500() throws Exception {
		String sinClave = nuevoUsuario("s", "sin-login-v1");
		String hashRaro = nuevoUsuario("r", "sin-login-test");
		Cookie xsrf = pedirCsrf();

		for (String email : List.of(sinClave, hashRaro)) {
			MvcResult r = intentarLogin(email, CLAVE, null, xsrf);
			assertThat(r.getResponse().getStatus()).as(email).isEqualTo(401);
			assertThat((String) JsonPath.read(cuerpo(r), "$.mensaje")).isEqualTo(MENSAJE_LOGIN);
		}
	}

	@Test
	void elEmailSeComparaRecortadoYSinDistinguirMayusculas() throws Exception {
		String email = nuevoUsuarioConClave("a");

		MvcResult r = intentarLogin("  " + email.toUpperCase() + " ", CLAVE, null, pedirCsrf());

		assertThat(r.getResponse().getStatus()).as(cuerpo(r)).isEqualTo(200);
		assertThat((String) JsonPath.read(cuerpo(r), "$.email")).isEqualTo(email);
	}

	@Test
	void loginSinCsrfDa403() throws Exception {
		String email = nuevoUsuarioConClave("a");

		mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + email + "\",\"clave\":\"" + CLAVE + "\"}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.mensaje").value("Falta el token CSRF o no es válido"));
	}

	@Test
	void loginConCamposVaciosDa400() throws Exception {
		mvc.perform(conCsrf(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"\",\"clave\":\"\"}"), pedirCsrf()))
				.andExpect(status().isBadRequest());
	}

	// ---------------------------------------------------------------- sesión, logout y CSRF

	@Test
	void logoutDa204InvalidaLaSesionYDespuesHayUn401() throws Exception {
		Navegador n = loguear(nuevoUsuarioConClave("a"));
		mvc.perform(get("/api/auth/yo").session(n.sesion())).andExpect(status().isOk());

		mvc.perform(conCsrf(post("/api/auth/logout").session(n.sesion()), n.xsrf())).andExpect(status().isNoContent());

		mvc.perform(get("/api/auth/yo").session(n.sesion())).andExpect(status().isUnauthorized());
		mvc.perform(get("/api/tareas").session(n.sesion())).andExpect(status().isUnauthorized());
	}

	@Test
	void unaEscrituraConSesionPeroSinCsrfDa403YConCsrfFunciona() throws Exception {
		Navegador n = loguear(nuevoUsuarioConClave("a"));
		String json = "{\"titulo\":\"ZZ-l1b tarea\",\"fecha\":\"2098-03-10\"}";

		mvc.perform(post("/api/tareas").session(n.sesion()).contentType(MediaType.APPLICATION_JSON).content(json))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.mensaje").value("Falta el token CSRF o no es válido"));
		// Un token que no coincide también se rechaza.
		mvc.perform(post("/api/tareas").session(n.sesion()).cookie(n.xsrf()).header("X-XSRF-TOKEN", "otro-token")
						.contentType(MediaType.APPLICATION_JSON).content(json))
				.andExpect(status().isForbidden());

		long id = crearTarea(n, "ZZ-l1b tarea");
		mvc.perform(conCsrf(delete("/api/tareas/" + id).session(n.sesion()), n.xsrf())).andExpect(status().isNoContent());
	}

	// ---------------------------------------------------------------- aislamiento por la API real

	@Test
	void conDosUsuariosCadaUnoVeSoloLoSuyo() throws Exception {
		Navegador a = loguear(nuevoUsuarioConClave("a"));
		Navegador b = loguear(nuevoUsuarioConClave("b"));
		long tareaA = crearTarea(a, "ZZ-l1b tarea A");
		long tareaB = crearTarea(b, "ZZ-l1b tarea B");

		assertThat(idsDeTareas(a).stream().map(Number::longValue)).contains(tareaA).doesNotContain(tareaB);
		assertThat(idsDeTareas(b).stream().map(Number::longValue)).contains(tareaB).doesNotContain(tareaA);
		// Lo ajeno responde igual que lo inexistente: 404.
		mvc.perform(get("/api/tareas/" + tareaA).session(b.sesion())).andExpect(status().isNotFound());
		mvc.perform(get("/api/tareas/" + tareaB).session(a.sesion())).andExpect(status().isNotFound());
		mvc.perform(conCsrf(delete("/api/tareas/" + tareaA).session(b.sesion()), b.xsrf())).andExpect(status().isNotFound());
		mvc.perform(get("/api/tareas/" + tareaA).session(a.sesion())).andExpect(status().isOk());
		// Y cada sesión es de su usuario.
		mvc.perform(get("/api/auth/yo").session(a.sesion())).andExpect(jsonPath("$.email").value(emailDe("a")));
		mvc.perform(get("/api/auth/yo").session(b.sesion())).andExpect(jsonPath("$.email").value(emailDe("b")));
	}
}
