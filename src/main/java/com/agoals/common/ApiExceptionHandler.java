package com.agoals.common;

import com.agoals.tarea.TareaInvalidaException;
import com.agoals.tarea.TareaNoEncontradaException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

@RestControllerAdvice
public class ApiExceptionHandler {

	public record ErrorResponse(String mensaje, List<String> errores) {
	}

	@ExceptionHandler(TareaNoEncontradaException.class)
	public ResponseEntity<ErrorResponse> noEncontrada(TareaNoEncontradaException e) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(TareaInvalidaException.class)
	public ResponseEntity<ErrorResponse> invalida(TareaInvalidaException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> validacion(MethodArgumentNotValidException e) {
		List<String> errores = e.getBindingResult().getFieldErrors().stream()
				.map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
				.toList();
		return ResponseEntity.badRequest().body(new ErrorResponse("Datos inválidos", errores));
	}
}
