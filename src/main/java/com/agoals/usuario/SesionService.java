package com.agoals.usuario;

import com.agoals.usuario.dto.LoginRequest;
import com.agoals.usuario.dto.UsuarioResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Service;

/**
 * Login por JSON. Spring Security no lo hace solo porque no usamos formLogin: autenticamos con el AuthenticationManager,
 * cambiamos el id de sesión (session fixation) y rotamos el token CSRF, y guardamos el contexto en la sesión (desde
 * Security 6 el guardado es explícito).
 */
@Service
public class SesionService {

	private final AuthenticationManager authenticationManager;
	private final SessionAuthenticationStrategy sessionStrategy;
	private final SecurityContextRepository contextRepository;
	private final SecurityContextHolderStrategy holderStrategy = SecurityContextHolder.getContextHolderStrategy();

	public SesionService(AuthenticationManager authenticationManager, SessionAuthenticationStrategy sessionStrategy,
			SecurityContextRepository contextRepository) {
		this.authenticationManager = authenticationManager;
		this.sessionStrategy = sessionStrategy;
		this.contextRepository = contextRepository;
	}

	public UsuarioResponse iniciar(LoginRequest request, HttpServletRequest http, HttpServletResponse response) {
		Authentication autenticado;
		try {
			autenticado = authenticationManager.authenticate(
					UsernamePasswordAuthenticationToken.unauthenticated(request.email().trim(), request.clave()));
		} catch (AuthenticationException e) {
			throw new CredencialesInvalidasException();
		}
		sessionStrategy.onAuthentication(autenticado, http, response);
		SecurityContext contexto = holderStrategy.createEmptyContext();
		contexto.setAuthentication(autenticado);
		holderStrategy.setContext(contexto);
		contextRepository.saveContext(contexto, http, response);
		// La estrategia dejó el token nuevo en el atributo de la petición: leerlo hace que salga en la cookie XSRF-TOKEN.
		if (http.getAttribute(CsrfToken.class.getName()) instanceof CsrfToken token) {
			token.getToken();
		}
		UsuarioAutenticado u = (UsuarioAutenticado) autenticado.getPrincipal();
		return new UsuarioResponse(u.getId(), u.getNombreUsuario(), u.getEmail());
	}
}
