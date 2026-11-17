package com.agoals.usuario;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.rememberme.PersistentRememberMeToken;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Gracia de rotación del remember-me, sin base de datos: tokens en memoria y reloj movible. */
class RecordarmeServicesTest {

	/** Tokens en un mapa, sin DataSource; cuenta los updateToken para comprobar que la gracia no escribe. */
	static class TokensEnMemoria extends TokensRecordarmeRepository {
		final Map<String, PersistentRememberMeToken> filas = new LinkedHashMap<>();
		int updates;

		@Override
		public void createNewToken(PersistentRememberMeToken t) {
			filas.put(t.getSeries(), t);
		}

		@Override
		public void updateToken(String series, String tokenValue, Date lastUsed) {
			updates++;
			filas.put(series, new PersistentRememberMeToken(filas.get(series).getUsername(), series, tokenValue, lastUsed));
		}

		@Override
		public PersistentRememberMeToken getTokenForSeries(String series) {
			return filas.get(series);
		}

		@Override
		public void removeUserTokens(String username) {
			filas.values().removeIf(t -> t.getUsername().equals(username));
		}

		@Override
		public void removeSeries(String series) {
			filas.remove(series);
		}

		@Override
		public void borrarVencidos(String username, Instant antesDe) {
		}
	}

	private RelojMovible reloj;
	private TokensEnMemoria tokens;
	private RecordarmeServices servicio;
	private Authentication auth;

	@BeforeEach
	void preparar() {
		reloj = new RelojMovible(Instant.parse("2026-11-17T12:00:00Z"));
		tokens = new TokensEnMemoria();
		servicio = new RecordarmeServices("clave-de-prueba", email -> new UsuarioAutenticado(7L, "ana", email, "x"),
				tokens, reloj, Duration.ofDays(30), Duration.ofSeconds(60), 100, false);
		UsuarioAutenticado u = new UsuarioAutenticado(7L, "ana", "ana@x.com", null);
		auth = UsernamePasswordAuthenticationToken.authenticated(u, null, List.of());
	}

	/** Hace "login con recordarme" y devuelve la cookie que recibiría el navegador. */
	private Cookie cookieInicial() {
		MockHttpServletResponse res = new MockHttpServletResponse();
		servicio.loginSuccess(new MockHttpServletRequest(), res, auth);
		Cookie c = res.getCookie(RecordarmeServices.COOKIE);
		assertThat(c).isNotNull();
		return c;
	}

	private Authentication autoLogin(Cookie cookie, MockHttpServletResponse res) {
		MockHttpServletRequest req = new MockHttpServletRequest();
		req.setCookies(new Cookie(cookie.getName(), cookie.getValue()));
		return servicio.autoLogin(req, res);
	}

	@Test
	void dentroDeLaGraciaElMismoTokenEntraSinEscribirEnLaBase() {
		Cookie c0 = cookieInicial();
		MockHttpServletResponse r1 = new MockHttpServletResponse();
		assertThat(autoLogin(c0, r1)).isNotNull();
		assertThat(tokens.updates).isEqualTo(1);

		reloj.avanzar(Duration.ofSeconds(30));
		MockHttpServletResponse r2 = new MockHttpServletResponse();
		Authentication segunda = autoLogin(c0, r2);

		assertThat(segunda).isNotNull();
		assertThat(((UsuarioAutenticado) segunda.getPrincipal()).getId()).isEqualTo(7L);
		assertThat(tokens.updates).as("la gracia no rota ni escribe").isEqualTo(1);
		assertThat(tokens.filas).hasSize(1);
		// Las dos respuestas llevan la misma cookie: la del token que ya está guardado.
		assertThat(r2.getCookie(RecordarmeServices.COOKIE).getValue()).isEqualTo(r1.getCookie(RecordarmeServices.COOKIE).getValue());
	}

	@Test
	void unTokenDistintoDelAnteriorEsRoboAunqueEsteDentroDeLaVentana() {
		Cookie c0 = cookieInicial();
		autoLogin(c0, new MockHttpServletResponse()); // rota: la gracia recuerda c0 -> c1
		String serie = tokens.filas.keySet().iterator().next();
		// Como la cookie de Spring: cada valor codificado como URL (la serie lleva "+", "/" o "=") y todo en Base64.
		String falsa = java.util.Base64.getEncoder().encodeToString(
				(java.net.URLEncoder.encode(serie, java.nio.charset.StandardCharsets.UTF_8) + ":token-inventado")
						.getBytes(java.nio.charset.StandardCharsets.UTF_8));

		MockHttpServletResponse res = new MockHttpServletResponse();
		Authentication a = autoLogin(new Cookie(RecordarmeServices.COOKIE, falsa), res);

		assertThat(a).isNull();
		assertThat(tokens.filas).as("el robo borra todos los tokens del usuario").isEmpty();
		assertThat(res.getCookie(RecordarmeServices.COOKIE).getMaxAge()).isZero();
	}

	@Test
	void elMapaDeGraciaEstaAcotadoYLimpiaLosVencidos() {
		Instant t0 = reloj.instant();
		GraciaDeRotacion gracia = new GraciaDeRotacion(Duration.ofSeconds(60), 3, t0);
		for (int i = 0; i < 10; i++) {
			gracia.registrar("s" + i, "u@x.com", "a" + i, "n" + i, t0);
		}
		assertThat(gracia.tamano()).isEqualTo(3);
		assertThat(gracia.vigente("s9", t0.plusSeconds(59))).isNotNull();
		assertThat(gracia.vigente("s9", t0.plusSeconds(60))).as("vence al cumplirse la ventana").isNull();

		gracia.vigente("s9", t0.plus(Duration.ofMinutes(5))); // la limpieza corre al consultar
		assertThat(gracia.tamano()).isZero();
	}
}
