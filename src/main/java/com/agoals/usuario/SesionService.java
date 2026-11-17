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
 * Login por JSON. Spring Security no lo hace solo porque no usamos formLogin: antes de autenticar consulta el freno de
 * intentos (429 sin tocar la base), autentica con el AuthenticationManager, cambia el id de sesión (session fixation),
 * rota el token CSRF, guarda el contexto en la sesión (desde Security 6 el guardado es explícito) y, solo si el cliente
 * pidió "recordarme", activa el remember-me a mano (loginSuccess).
 */
@Service
public class SesionService {

	private final AuthenticationManager authenticationManager;
	private final SessionAuthenticationStrategy sessionStrategy;
	private final SecurityContextRepository contextRepository;
	private final FrenoDeLogin freno;
	private final RecordarmeServices recordarme;
	private final SecurityContextHolderStrategy holderStrategy = SecurityContextHolder.getContextHolderStrategy();

	public SesionService(AuthenticationManager authenticationManager, SessionAuthenticationStrategy sessionStrategy,
			SecurityContextRepository contextRepository, FrenoDeLogin freno, RecordarmeServices recordarme) {
		this.authenticationManager = authenticationManager;
		this.sessionStrategy = sessionStrategy;
		this.contextRepository = contextRepository;
		this.freno = freno;
		this.recordarme = recordarme;
	}

	public UsuarioResponse iniciar(LoginRequest request, HttpServletRequest http, HttpServletResponse response) {
		String ip = http.getRemoteAddr();
		String email = request.email().trim();
		freno.comprobar(ip, email);
		Authentication autenticado;
		try {
			autenticado = authenticationManager
					.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(email, request.clave()));
		} catch (AuthenticationException e) {
			freno.registrarFallo(ip, email);
			throw new CredencialesInvalidasException();
		}
		freno.registrarExito(ip, email);
		sessionStrategy.onAuthentication(autenticado, http, response);
		SecurityContext contexto = holderStrategy.createEmptyContext();
		contexto.setAuthentication(autenticado);
		holderStrategy.setContext(contexto);
		contextRepository.saveContext(contexto, http, response);
		// La estrategia dejó el token nuevo en el atributo de la petición: leerlo hace que salga en la cookie XSRF-TOKEN.
		if (http.getAttribute(CsrfToken.class.getName()) instanceof CsrfToken token) {
			token.getToken();
		}
		// Quien entra olvida el dispositivo recordado de antes: sin esto, entrar como B sin "recordarme" en un equipo con
		// la cookie de A volvería a dejarlo como A cuando venza la sesión.
		recordarme.olvidarDispositivo(http, response);
		if (request.recordar()) {
			recordarme.loginSuccess(http, response, autenticado);
		}
		UsuarioAutenticado u = (UsuarioAutenticado) autenticado.getPrincipal();
		return new UsuarioResponse(u.getId(), u.getNombreUsuario(), u.getEmail());
	}
}
