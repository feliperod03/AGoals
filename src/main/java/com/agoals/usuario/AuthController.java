package com.agoals.usuario;

import com.agoals.common.UsuarioActual;
import com.agoals.usuario.dto.LoginRequest;
import com.agoals.usuario.dto.UsuarioResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** El logout (POST /api/auth/logout) lo atiende el LogoutFilter de Spring Security, no este controller. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final SesionService sesionService;
	private final UsuarioService usuarioService;
	private final UsuarioActual usuarioActual;

	public AuthController(SesionService sesionService, UsuarioService usuarioService, UsuarioActual usuarioActual) {
		this.sesionService = sesionService;
		this.usuarioService = usuarioService;
		this.usuarioActual = usuarioActual;
	}

	@PostMapping("/login")
	public UsuarioResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http,
			HttpServletResponse response) {
		return sesionService.iniciar(request, http, response);
	}

	@GetMapping("/yo")
	public UsuarioResponse yo() {
		return usuarioService.buscar(usuarioActual.id());
	}

	/**
	 * Para que el frontend consiga la cookie XSRF-TOKEN antes de loguearse (P2). Leer el token diferido hace que
	 * Spring Security lo genere y lo escriba en la cookie; no se devuelve en el cuerpo.
	 */
	@GetMapping("/csrf")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void csrf(CsrfToken token) {
		token.getToken();
	}
}
