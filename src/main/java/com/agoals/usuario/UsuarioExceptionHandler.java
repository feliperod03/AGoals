package com.agoals.usuario;

import com.agoals.common.ApiExceptionHandler.ErrorResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

/**
 * Errores propios del módulo usuario. Es global (sin assignableTypes) a propósito: UsuarioNoAutenticadoException la
 * puede lanzar UsuarioActualDeSesion desde cualquier service, y los filtros de seguridad también delegan en los
 * handlers sin controller. Así common.ApiExceptionHandler no tiene que conocer este módulo.
 */
@RestControllerAdvice
public class UsuarioExceptionHandler {

	@ExceptionHandler(CredencialesInvalidasException.class)
	public ResponseEntity<ErrorResponse> credencialesInvalidas(CredencialesInvalidasException e) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	/** Freno de intentos (L2): 429 con el tiempo de espera en Retry-After (segundos) y en el mensaje. */
	@ExceptionHandler(LoginBloqueadoException.class)
	public ResponseEntity<ErrorResponse> loginBloqueado(LoginBloqueadoException e) {
		return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
				.header(HttpHeaders.RETRY_AFTER, String.valueOf(e.getSegundos()))
				.body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(UsuarioNoAutenticadoException.class)
	public ResponseEntity<ErrorResponse> noAutenticado(UsuarioNoAutenticadoException e) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ErrorResponse(e.getMessage(), List.of()));
	}
}
