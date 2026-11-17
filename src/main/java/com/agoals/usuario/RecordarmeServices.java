package com.agoals.usuario;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.rememberme.CookieTheftException;
import org.springframework.security.web.authentication.rememberme.PersistentRememberMeToken;
import org.springframework.security.web.authentication.rememberme.PersistentTokenBasedRememberMeServices;
import org.springframework.security.web.authentication.rememberme.RememberMeAuthenticationException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Remember-me con tokens persistentes (tabla persistent_logins). Sobre PersistentTokenBasedRememberMeServices cambia tres cosas:
 * <ul>
 * <li>El logout borra solo la serie de ESE dispositivo (Spring borra todos los del usuario), también si la petición trae
 * solo la cookie y no hay sesión.</li>
 * <li>Margen de gracia: si llega el token anterior de una serie recién rotada, dentro de la ventana, se autentica sin
 * rotar otra vez (varias peticiones en paralelo con la misma cookie no son un robo). Fuera de la ventana, o con cualquier
 * otro token, vale la semántica de robo de Spring: se borran todos los tokens del usuario.</li>
 * <li>Un robo no acaba en un 500: se loguea y la petición sigue como anónima (401).</li>
 * </ul>
 * La clave interna solo la usa el RememberMeAuthenticationProvider dentro del proceso (con tokens persistentes no va en
 * la cookie), por eso puede ser aleatoria en cada arranque. Si algún día se usa TokenBasedRememberMeServices (cookie
 * firmada) haría falta una clave fija y secreta.
 */
public class RecordarmeServices extends PersistentTokenBasedRememberMeServices {

	public static final String COOKIE = "AGOALS_RECORDARME";

	private final TokensRecordarmeRepository tokens;
	private final Clock clock;
	private final Duration duracion;
	private final GraciaDeRotacion gracia;

	public RecordarmeServices(String key, UserDetailsService userDetailsService, TokensRecordarmeRepository tokens,
			Clock clock, Duration duracion, Duration gracia, int maxEntradas, boolean cookieSegura) {
		super(key, userDetailsService, tokens);
		this.tokens = tokens;
		this.clock = clock;
		this.duracion = duracion;
		this.gracia = new GraciaDeRotacion(gracia, maxEntradas, clock.instant());
		setCookieName(COOKIE);
		// La decisión de recordar la toma SesionService (el login es JSON, no hay parámetro en la petición).
		setAlwaysRemember(true);
		setUseSecureCookie(cookieSegura);
		setTokenValiditySeconds((int) duracion.toSeconds());
		// HttpOnly ya lo pone Spring; Secure, arriba. Los atributos de la cookie de cancelación no pasan por aquí.
		setCookieCustomizer(c -> c.setAttribute("SameSite", "Lax"));
	}

	@Override
	public Authentication autoLogin(HttpServletRequest request, HttpServletResponse response) {
		try {
			return super.autoLogin(request, response);
		} catch (CookieTheftException e) {
			// Spring ya borró los tokens del usuario y canceló la cookie antes de relanzar: aquí solo se evita el 500.
			logger.warn("Posible robo de la cookie de remember-me: se borraron todos los tokens del usuario.");
			return null;
		}
	}

	@Override
	protected synchronized UserDetails processAutoLoginCookie(String[] cookieTokens, HttpServletRequest request,
			HttpServletResponse response) {
		Instant ahora = clock.instant();
		if (cookieTokens.length == 2) {
			String serie = cookieTokens[0];
			GraciaDeRotacion.Rotacion rotacion = gracia.vigente(serie, ahora);
			if (rotacion != null && rotacion.anterior().equals(cookieTokens[1])) {
				PersistentRememberMeToken actual = tokens.getTokenForSeries(serie);
				if (actual != null && actual.getTokenValue().equals(rotacion.nuevo())) {
					// Sin rotar ni escribir en la base: se devuelve la cookie con el token que ya está guardado.
					setCookie(new String[] { serie, rotacion.nuevo() }, getTokenValiditySeconds(), request, response);
					return getUserDetailsService().loadUserByUsername(rotacion.usuario());
				}
			}
		}
		try {
			UserDetails usuario = super.processAutoLoginCookie(cookieTokens, request, response);
			// Super rotó el token (el valor nuevo es privado de Spring): se lee de la base para recordarlo.
			PersistentRememberMeToken rotado = tokens.getTokenForSeries(cookieTokens[0]);
			if (rotado != null) {
				gracia.registrar(cookieTokens[0], rotado.getUsername(), cookieTokens[1], rotado.getTokenValue(), ahora);
			}
			return usuario;
		} catch (CookieTheftException e) {
			gracia.borrarTodo();
			throw e;
		}
	}

	@Override
	protected void onLoginSuccess(HttpServletRequest request, HttpServletResponse response,
			Authentication successfulAuthentication) {
		try {
			tokens.borrarVencidos(successfulAuthentication.getName(), clock.instant().minus(duracion));
		} catch (DataAccessException e) {
			logger.error("No se pudieron limpiar los tokens vencidos", e);
		}
		super.onLoginSuccess(request, response, successfulAuthentication);
	}

	/** Logout: solo el dispositivo de esta petición (Spring borraría los de todos), con o sin sesión. */
	@Override
	public void logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
		olvidarDispositivo(request, response);
	}

	/** Borra la serie de la cookie de remember-me de esta petición (si la hay) y la cancela. */
	public void olvidarDispositivo(HttpServletRequest request, HttpServletResponse response) {
		String valor = extractRememberMeCookie(request);
		if (valor == null) {
			return;
		}
		if (!valor.isEmpty()) {
			try {
				String[] partes = decodeCookie(valor);
				if (partes.length > 0) {
					tokens.removeSeries(partes[0]);
					synchronized (this) {
						gracia.borrarSerie(partes[0]);
					}
				}
			} catch (RememberMeAuthenticationException e) {
				// Cookie mal formada: no hay nada que borrar en la base.
			}
		}
		cancelCookie(request, response);
	}
}
