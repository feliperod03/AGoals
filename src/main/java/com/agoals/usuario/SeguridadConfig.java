package com.agoals.usuario;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.authentication.RememberMeAuthenticationProvider;
import org.springframework.security.web.authentication.rememberme.RememberMeAuthenticationFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

import javax.sql.DataSource;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

/**
 * Seguridad de la API: sesión HTTP (cookie HttpOnly) y CSRF para SPA (cookie XSRF-TOKEN + cabecera X-XSRF-TOKEN).
 * Todo /api/** exige sesión salvo el login y el endpoint que entrega la cookie CSRF. Los errores 401/403 se
 * delegan en ApiExceptionHandler para que salgan como JSON con el mismo formato que el resto de la API.
 */
@Configuration
public class SeguridadConfig {

	// static: UsuarioService necesita el encoder y este config necesita a UsuarioService; así no hay ciclo de beans.
	@Bean
	public static PasswordEncoder passwordEncoder() {
		DelegatingPasswordEncoder encoder = (DelegatingPasswordEncoder) PasswordEncoderFactories
				.createDelegatingPasswordEncoder();
		// Un hash sin prefijo {id} no debe dar un 500: simplemente no coincide.
		encoder.setDefaultPasswordEncoderForMatches(new PasswordEncoder() {
			@Override
			public String encode(CharSequence raw) {
				throw new UnsupportedOperationException();
			}

			@Override
			public boolean matches(CharSequence raw, String encoded) {
				return false;
			}
		});
		return encoder;
	}

	@Bean
	public AuthenticationManager authenticationManager(UserDetailsService userDetailsService,
			PasswordEncoder passwordEncoder) {
		DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
		provider.setPasswordEncoder(passwordEncoder);
		return new ProviderManager(provider);
	}

	@Bean
	public SecurityContextRepository securityContextRepository() {
		return new HttpSessionSecurityContextRepository();
	}

	/** Cookie legible por JS (no HttpOnly), con las mismas banderas Secure y SameSite que la de sesión. */
	@Bean
	public CsrfTokenRepository csrfTokenRepository(@Value("${agoals.seguridad.cookie-segura:false}") boolean segura) {
		CookieCsrfTokenRepository repo = CookieCsrfTokenRepository.withHttpOnlyFalse();
		repo.setCookieCustomizer(c -> c.secure(segura).sameSite("Lax"));
		return repo;
	}

	/** Al hacer login: cambia el id de sesión (session fixation) y rota el token CSRF. */
	@Bean
	public SessionAuthenticationStrategy sessionAuthenticationStrategy(CsrfTokenRepository csrfTokenRepository) {
		return new CompositeSessionAuthenticationStrategy(List.of(new ChangeSessionIdAuthenticationStrategy(),
				new CsrfAuthenticationStrategy(csrfTokenRepository)));
	}

	/** Reloj inyectable (el freno de intentos y la gracia del remember-me); los tests lo reemplazan. */
	@Bean
	public Clock clock() {
		return Clock.systemUTC();
	}

	@Bean
	public TokensRecordarmeRepository tokensRecordarmeRepository(DataSource dataSource) {
		TokensRecordarmeRepository repo = new TokensRecordarmeRepository();
		repo.setDataSource(dataSource);
		return repo;
	}

	/**
	 * Remember-me persistente. La clave es aleatoria en cada arranque a propósito (ver RecordarmeServices): no hay
	 * secreto que guardar ni variable de entorno, y las cookies siguen valiendo porque los tokens están en la base.
	 */
	@Bean
	public RecordarmeServices recordarmeServices(UserDetailsService userDetailsService,
			TokensRecordarmeRepository tokens, Clock clock,
			@Value("${agoals.seguridad.recordarme.duracion:30d}") Duration duracion,
			@Value("${agoals.seguridad.recordarme.gracia:60s}") Duration gracia,
			@Value("${agoals.seguridad.login.max-entradas:10000}") int maxEntradas,
			@Value("${agoals.seguridad.cookie-segura:false}") boolean cookieSegura) {
		byte[] bytes = new byte[32];
		new SecureRandom().nextBytes(bytes);
		String clave = Base64.getEncoder().encodeToString(bytes);
		return new RecordarmeServices(clave, userDetailsService, tokens, clock, duracion, gracia, maxEntradas,
				cookieSegura);
	}

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http, CsrfTokenRepository csrfTokenRepository,
			SecurityContextRepository securityContextRepository, RecordarmeServices recordarme,
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) throws Exception {
		// El filtro de remember-me se arma a mano (sin http.rememberMe()): el configurer le pasa la estrategia de sesión
		// compartida, que incluye CsrfAuthenticationStrategy, y el login automático rotaría el token CSRF: las peticiones
		// en paralelo de la SPA con el token anterior darían 403. Aquí solo se cambia el id de sesión.
		// No es un @Bean a propósito: Boot lo registraría además como filtro de servlet.
		RememberMeAuthenticationFilter recordarmeFiltro = new RememberMeAuthenticationFilter(
				new ProviderManager(new RememberMeAuthenticationProvider(recordarme.getKey())), recordarme);
		recordarmeFiltro.setSecurityContextRepository(securityContextRepository); // crea la sesión y guarda el contexto
		recordarmeFiltro.setSessionAuthenticationStrategy(new ChangeSessionIdAuthenticationStrategy());
		http
				.csrf(csrf -> csrf.spa().csrfTokenRepository(csrfTokenRepository))
				.securityContext(sc -> sc.securityContextRepository(securityContextRepository))
				.authorizeHttpRequests(a -> a
						.requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
						.requestMatchers("/error").permitAll()
						.anyRequest().authenticated())
				.exceptionHandling(e -> e
						.authenticationEntryPoint((req, res, ex) -> resolver.resolveException(req, res, null, ex))
						.accessDeniedHandler((req, res, ex) -> resolver.resolveException(req, res, null, ex)))
				.addFilterAt(recordarmeFiltro, RememberMeAuthenticationFilter.class)
				.logout(l -> l
						.logoutUrl("/api/auth/logout")
						.addLogoutHandler(recordarme) // borra el token de este dispositivo y cancela la cookie
						.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
				.requestCache(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable);
		return http.build();
	}
}
