package com.agoals.usuario;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Remember-me persistente (L2) de punta a punta contra el PostgreSQL real, con los filtros de Spring Security.
 * Crea usuarios ZZ-l2-... con JdbcTemplate y los borra por id al terminar (la FK arrastra sus tokens); nunca toca al
 * usuario 1. El reloj es movible para probar la gracia de rotación. MockMvc no guarda cookies: el test hace de
 * navegador y lleva a mano la cookie de remember-me y la XSRF-TOKEN.
 */
class RecordarmeIntegracionTest extends BaseConRelojMovible {

	private static final String CLAVE = "clave-de-prueba-123";
	private static final String RM = RecordarmeServices.COOKIE;

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
		assertThat(jdbc.queryForObject("SELECT count(*) FROM persistent_logins WHERE username LIKE 'zz-l2-%'",
				Integer.class)).as("tokens huérfanos").isZero();
		for (Long id : creados) {
			assertThat(jdbc.queryForObject("SELECT count(*) FROM tarea WHERE usuario_id = ?", Integer.class, id)).isZero();
		}
	}

	// ---------------------------------------------------------------- helpers

	private String nuevoUsuario(String letra) {
		String email = "zz-l2-" + letra + "-" + hex + "@agoals.local";
		creados.add(jdbc.queryForObject(
				"INSERT INTO usuario (nombre_usuario, email, contrasena_hash) VALUES (?, ?, ?) RETURNING id", Long.class,
				"ZZ-l2-" + letra + "-" + hex, email, encoder.encode(CLAVE)));
		return email;
	}

	private int filas(String email) {
		return jdbc.queryForObject("SELECT count(*) FROM persistent_logins WHERE username = ?", Integer.class, email);
	}

	private String tokenEnBase(String email) {
		return jdbc.queryForObject("SELECT token FROM persistent_logins WHERE username = ?", String.class, email);
	}

	private Cookie pedirCsrf() throws Exception {
		return ultimaCookie(mvc.perform(get("/api/auth/csrf")).andExpect(status().isNoContent()).andReturn(), "XSRF-TOKEN");
	}

	/** El navegador se queda con la última cookie que llega con ese nombre. */
	private static Cookie ultimaCookie(MvcResult r, String nombre) {
		Cookie ultima = null;
		for (Cookie c : r.getResponse().getCookies()) {
			if (c.getName().equals(nombre)) {
				ultima = c;
			}
		}
		return ultima;
	}

	private static Cookie cookieRm(MvcResult r) {
		Cookie c = ultimaCookie(r, RM);
		assertThat(c).as("cookie " + RM).isNotNull();
		return c;
	}

	private static String cuerpo(MvcResult r) throws Exception {
		return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	/** Lo que Spring guarda en la base: el segundo valor de la cookie ("serie:token" en Base64, cada parte URL-encoded). */
	private static String tokenDeCookie(Cookie c) {
		String v = c.getValue();
		while (v.length() % 4 != 0) {
			v += "=";
		}
		String[] partes = new String(Base64.getDecoder().decode(v), StandardCharsets.UTF_8).split(":");
		return URLDecoder.decode(partes[1], StandardCharsets.UTF_8);
	}

	private MvcResult login(String email, boolean recordarme, Cookie xsrf, Cookie... extra) throws Exception {
		MockHttpServletRequestBuilder b = post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
				.content("{\"email\":\"" + email + "\",\"clave\":\"" + CLAVE + "\",\"recordarme\":" + recordarme + "}")
				.cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
		if (extra.length > 0) {
			b.cookie(extra);
		}
		MvcResult r = mvc.perform(b).andReturn();
		assertThat(r.getResponse().getStatus()).as("login: " + cuerpo(r)).isEqualTo(200);
		return r;
	}

	/** Un dispositivo "recordado": la cookie de remember-me, la XSRF-TOKEN y la sesión del login. */
	private record Dispositivo(Cookie recordarme, Cookie xsrf, MockHttpSession sesion) {
	}

	private Dispositivo loginRecordando(String email) throws Exception {
		MvcResult r = login(email, true, pedirCsrf());
		return new Dispositivo(cookieRm(r), ultimaCookie(r, "XSRF-TOKEN"), (MockHttpSession) r.getRequest().getSession(false));
	}

	private MvcResult yoSoloConCookie(Cookie rm) throws Exception {
		return mvc.perform(get("/api/auth/yo").cookie(rm)).andReturn();
	}

	// ---------------------------------------------------------------- crear el token

	@Test
	void elLoginConRecordarmeCreaLaFilaYLaCookieConSusBanderas() throws Exception {
		String email = nuevoUsuario("a");

		MvcResult r = login(email, true, pedirCsrf());

		assertThat(filas(email)).isEqualTo(1);
		Cookie c = cookieRm(r);
		assertThat(c.getValue()).isNotEmpty();
		assertThat(c.isHttpOnly()).isTrue();
		assertThat(c.getAttribute("SameSite")).isEqualTo("Lax");
		assertThat(c.getSecure()).as("cookie-segura=false en desarrollo").isFalse();
		assertThat(c.getMaxAge()).isEqualTo(30 * 24 * 3600);
	}

	@Test
	void sinRecordarmeNoHayFilaNiCookie() throws Exception {
		String email = nuevoUsuario("a");

		MvcResult r = login(email, false, pedirCsrf());

		assertThat(filas(email)).isZero();
		assertThat(ultimaCookie(r, RM)).isNull();
	}

	// ---------------------------------------------------------------- entrar solo con la cookie

	@Test
	void conSoloLaCookieSeEntraSeCreaLaSesionYElTokenRota() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo d = loginRecordando(email);
		String tokenAntes = tokenEnBase(email);

		MvcResult r = yoSoloConCookie(d.recordarme());

		assertThat(r.getResponse().getStatus()).as(cuerpo(r)).isEqualTo(200);
		assertThat((String) JsonPath.read(cuerpo(r), "$.email")).isEqualTo(email);
		assertThat(tokenEnBase(email)).isNotEqualTo(tokenAntes);
		assertThat(cookieRm(r).getValue()).isNotEqualTo(d.recordarme().getValue());
		// El filtro creó la sesión: ahora alcanza sola, sin la cookie.
		MockHttpSession sesion = (MockHttpSession) r.getRequest().getSession(false);
		assertThat(sesion).isNotNull();
		mvc.perform(get("/api/auth/yo").session(sesion)).andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
	}

	@Test
	void conSoloLaCookieUnaEscrituraConCsrfValidoFuncionaYNoRotaElToken() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo d = loginRecordando(email);
		String json = "{\"titulo\":\"ZZ-l2 tarea\",\"fecha\":\"2098-03-10\"}";

		// Sin sesión (como tras reiniciar el backend), con la cookie de remember-me y el CSRF del login.
		MvcResult r = mvc.perform(post("/api/tareas").cookie(d.recordarme(), d.xsrf()).header("X-XSRF-TOKEN", d.xsrf().getValue())
				.contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();

		assertThat(r.getResponse().getStatus()).as(cuerpo(r)).isEqualTo(201);
		Cookie xsrfNueva = ultimaCookie(r, "XSRF-TOKEN");
		if (xsrfNueva != null) {
			assertThat(xsrfNueva.getValue()).as("el login automático no rota el token CSRF").isEqualTo(d.xsrf().getValue());
		}
		// Una segunda escritura con la sesión que creó el filtro y el MISMO token CSRF sigue funcionando.
		MockHttpSession sesion = (MockHttpSession) r.getRequest().getSession(false);
		mvc.perform(post("/api/tareas").session(sesion).cookie(d.xsrf()).header("X-XSRF-TOKEN", d.xsrf().getValue())
				.contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isCreated());
	}

	// ---------------------------------------------------------------- logout

	@Test
	void elLogoutBorraSoloElDispositivoYLaCookieViejaYaNoEntra() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo a = loginRecordando(email);
		Dispositivo b = loginRecordando(email);
		assertThat(filas(email)).isEqualTo(2);

		MvcResult salir = mvc.perform(post("/api/auth/logout").session(a.sesion()).cookie(a.recordarme(), a.xsrf())
				.header("X-XSRF-TOKEN", a.xsrf().getValue())).andReturn();

		assertThat(salir.getResponse().getStatus()).isEqualTo(204);
		assertThat(filas(email)).as("solo se borró el dispositivo que salió").isEqualTo(1);
		assertThat(cookieRm(salir).getMaxAge()).as("cookie cancelada").isZero();
		assertThat(yoSoloConCookie(a.recordarme()).getResponse().getStatus()).isEqualTo(401);
		assertThat(yoSoloConCookie(b.recordarme()).getResponse().getStatus()).as("el otro dispositivo sigue").isEqualTo(200);
	}

	@Test
	void elLogoutSoloConLaCookieSinSesionTambienBorraLaFila() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo d = loginRecordando(email);

		MvcResult salir = mvc.perform(post("/api/auth/logout").cookie(d.recordarme(), d.xsrf())
				.header("X-XSRF-TOKEN", d.xsrf().getValue())).andReturn();

		assertThat(salir.getResponse().getStatus()).isEqualTo(204);
		assertThat(filas(email)).isZero();
		assertThat(yoSoloConCookie(d.recordarme()).getResponse().getStatus()).isEqualTo(401);
	}

	@Test
	void unLoginNuevoSinRecordarmeOlvidaElDispositivoRecordadoDeAntes() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo d = loginRecordando(email);
		assertThat(filas(email)).isEqualTo(1);

		MvcResult r = login(email, false, d.xsrf(), d.recordarme());

		assertThat(filas(email)).isZero();
		assertThat(cookieRm(r).getMaxAge()).as("cookie cancelada").isZero();
	}

	// ---------------------------------------------------------------- robo y cookies inválidas

	@Test
	void reusarUnTokenYaRotadoFueraDeLaGraciaEsRobo() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo d = loginRecordando(email);
		MvcResult primera = yoSoloConCookie(d.recordarme());
		assertThat(primera.getResponse().getStatus()).isEqualTo(200);
		Cookie rotada = cookieRm(primera);
		RELOJ.avanzar(Duration.ofSeconds(61)); // fuera de la ventana de gracia (60 s)

		MvcResult robo = yoSoloConCookie(d.recordarme()); // el token viejo otra vez

		assertThat(robo.getResponse().getStatus()).as("401 JSON, no un 500").isEqualTo(401);
		assertThat(robo.getResponse().getContentType()).contains("json");
		assertThat(filas(email)).as("el robo borra todos los tokens del usuario").isZero();
		assertThat(cookieRm(robo).getMaxAge()).isZero();
		assertThat(yoSoloConCookie(rotada).getResponse().getStatus()).as("la cookie rotada tampoco vale").isEqualTo(401);
	}

	@Test
	void dosPeticionesConElMismoTokenDentroDeLaGraciaEntranLasDos() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo d = loginRecordando(email);

		MvcResult primera = yoSoloConCookie(d.recordarme());
		MvcResult segunda = yoSoloConCookie(d.recordarme()); // mismo token, justo después

		assertThat(primera.getResponse().getStatus()).isEqualTo(200);
		assertThat(segunda.getResponse().getStatus()).as(cuerpo(segunda)).isEqualTo(200);
		assertThat(filas(email)).isEqualTo(1);
		String enBase = tokenEnBase(email);
		assertThat(tokenDeCookie(cookieRm(primera))).isEqualTo(enBase);
		assertThat(tokenDeCookie(cookieRm(segunda))).as("las dos respuestas dejan el mismo token final").isEqualTo(enBase);
	}

	@Test
	void laSegundaPeticionFueraDeLaGraciaEsRobo() throws Exception {
		String email = nuevoUsuario("a");
		Dispositivo d = loginRecordando(email);
		assertThat(yoSoloConCookie(d.recordarme()).getResponse().getStatus()).isEqualTo(200);
		RELOJ.avanzar(Duration.ofSeconds(61));

		MvcResult segunda = yoSoloConCookie(d.recordarme());

		assertThat(segunda.getResponse().getStatus()).isEqualTo(401);
		assertThat(filas(email)).isZero();
	}

	@Test
	void unaCookieMalFormadaOConSerieInexistenteDa401YSeCancela() throws Exception {
		MvcResult mala = yoSoloConCookie(new Cookie(RM, "basura!!"));
		String inexistente = Base64.getEncoder().encodeToString("nada:nada".getBytes(StandardCharsets.UTF_8));
		MvcResult sinSerie = yoSoloConCookie(new Cookie(RM, inexistente));

		assertThat(mala.getResponse().getStatus()).isEqualTo(401);
		assertThat(cookieRm(mala).getMaxAge()).isZero();
		assertThat(sinSerie.getResponse().getStatus()).isEqualTo(401);
		assertThat(cookieRm(sinSerie).getMaxAge()).isZero();
	}
}
