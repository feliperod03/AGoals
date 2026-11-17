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
import org.springframework.web.servlet.HandlerExceptionResolver;

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

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http, CsrfTokenRepository csrfTokenRepository,
			SecurityContextRepository securityContextRepository,
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) throws Exception {
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
				.logout(l -> l
						.logoutUrl("/api/auth/logout")
						.logoutSuccessHandler(new HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT)))
				.requestCache(AbstractHttpConfigurer::disable)
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable);
		return http.build();
	}
}
